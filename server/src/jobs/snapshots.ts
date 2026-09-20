/**
 * Snapshot scheduling architecture.
 *
 * Invoke via:
 * - cron / hosting scheduler hitting POST /api/jobs/snapshots?kind=market|network|all
 * - Render cron job
 * - manual admin trigger (authenticated)
 * - CLI: `npm run job:snapshots -- --kind=all`
 *
 * Recommended cadence:
 * - market: every 15 minutes
 * - network: every 30–60 minutes
 *
 * Domain logic does not hard-code a vendor scheduler.
 */

import type { ForgeDb } from '../db/client.js';
import {
  fetchLiveMarketQuote,
  fetchLiveNetworkSnapshot,
} from '../services/market.js';
import {
  insertMarketSnapshot,
  insertNetworkSnapshot,
} from '../db/repositories/snapshotRepo.js';

export async function captureMarketSnapshot(db: ForgeDb): Promise<{
  ok: boolean;
  id: string;
  error: string | null;
}> {
  try {
    const quote = await fetchLiveMarketQuote();
    const row = insertMarketSnapshot(db, {
      btcUsd: quote.btcPriceUsd,
      change24hPct: quote.change24hPct,
      provider: quote.provider ?? 'coingecko',
      sourceTimestamp: quote.timestamp ?? quote.fetchedAt ?? null,
      success: true,
      error: null,
      payload: quote,
    });
    return { ok: true, id: row.id, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Market snapshot failed';
    const row = insertMarketSnapshot(db, {
      btcUsd: null,
      change24hPct: null,
      provider: 'coingecko',
      sourceTimestamp: null,
      success: false,
      error: message,
    });
    return { ok: false, id: row.id, error: message };
  }
}

export async function captureNetworkSnapshot(db: ForgeDb): Promise<{
  ok: boolean;
  id: string;
  error: string | null;
}> {
  try {
    const network = await fetchLiveNetworkSnapshot();
    const row = insertNetworkSnapshot(db, {
      networkHashrateEhs: network.networkHashrateEhs,
      difficulty: network.difficulty,
      blockHeight: network.blockHeight,
      blockSubsidyBtc: network.blockSubsidyBtc,
      estimatedNextAdjustment: network.estimatedRetargetDate,
      daysUntilAdjustment: network.daysUntilAdjustment,
      provider: network.provider ?? 'mempool.space',
      sourceTimestamp: network.fetchedAt ?? null,
      success: true,
      error: null,
      payload: network,
    });
    return { ok: true, id: row.id, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network snapshot failed';
    const row = insertNetworkSnapshot(db, {
      networkHashrateEhs: null,
      difficulty: null,
      blockHeight: null,
      blockSubsidyBtc: null,
      estimatedNextAdjustment: null,
      daysUntilAdjustment: null,
      provider: 'mempool.space',
      sourceTimestamp: null,
      success: false,
      error: message,
    });
    return { ok: false, id: row.id, error: message };
  }
}

export async function runSnapshotJob(
  db: ForgeDb,
  kind: 'market' | 'network' | 'all' = 'all',
): Promise<{
  market?: Awaited<ReturnType<typeof captureMarketSnapshot>>;
  network?: Awaited<ReturnType<typeof captureNetworkSnapshot>>;
}> {
  const out: {
    market?: Awaited<ReturnType<typeof captureMarketSnapshot>>;
    network?: Awaited<ReturnType<typeof captureNetworkSnapshot>>;
  } = {};
  if (kind === 'market' || kind === 'all') {
    out.market = await captureMarketSnapshot(db);
  }
  if (kind === 'network' || kind === 'all') {
    out.network = await captureNetworkSnapshot(db);
  }
  return out;
}
