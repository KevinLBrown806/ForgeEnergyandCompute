/**
 * Public market + Bitcoin network adapters.
 * No API keys. Timeouts + last-known-good cache.
 */

import { TtlCache } from './cache.js';
import { fetchJsonWithTimeout } from './publicFetch.js';

const cache = new TtlCache();
const MARKET_TTL_MS = 60_000;
const NETWORK_TTL_MS = 120_000;
const TIMEOUT_MS = 8_000;

const COINGECKO_PRICE =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
const MEMPOOL_HASHRATE = 'https://mempool.space/api/v1/mining/hashrate/3d';
const MEMPOOL_DIFFICULTY = 'https://mempool.space/api/v1/difficulty-adjustment';
const MEMPOOL_HEIGHT = 'https://mempool.space/api/blocks/tip/height';

export interface MarketQuote {
  btcPriceUsd: number;
  change24hPct: number | null;
  timestamp: string;
  provider: string;
  source: 'LIVE';
  fetchedAt: string;
  stale: boolean;
}

export interface NetworkSnapshot {
  networkHashrateEhs: number;
  difficulty: number | null;
  blockHeight: number | null;
  blockSubsidyBtc: number;
  blocksPerDay: number;
  nextDifficultyChangePct: number | null;
  estimatedRetargetDate: string | null;
  remainingBlocks: number | null;
  daysUntilAdjustment: number | null;
  provider: string;
  source: 'LIVE';
  fetchedAt: string;
  stale: boolean;
}

interface CoinGeckoPrice {
  bitcoin?: { usd?: number; usd_24h_change?: number };
}

interface MempoolHashrate {
  currentHashrate?: number;
  currentDifficulty?: number;
}

interface MempoolDifficulty {
  difficultyChange?: number;
  estimatedRetargetDate?: number;
  remainingBlocks?: number;
  remainingTime?: number;
}

export function blockSubsidyBtc(height: number): number {
  const era = Math.floor(height / 210_000);
  if (era >= 64) return 0;
  return 50 / 2 ** era;
}

/** mempool.space remainingTime is milliseconds; remainingBlocks / 144 is the fallback. */
export function estimateDaysUntilAdjustment(
  remainingBlocks: number | undefined,
  remainingTimeMs: number | undefined,
): number | null {
  if (typeof remainingBlocks === 'number' && remainingBlocks >= 0) {
    return remainingBlocks / 144;
  }
  if (typeof remainingTimeMs === 'number' && remainingTimeMs >= 0) {
    return remainingTimeMs / 86_400_000;
  }
  return null;
}

export async function fetchLiveMarketQuote(): Promise<MarketQuote> {
  const fresh = cache.get<MarketQuote>('market');
  if (fresh) return { ...fresh, stale: false };

  try {
    const raw = await fetchJsonWithTimeout<CoinGeckoPrice>(COINGECKO_PRICE, TIMEOUT_MS);
    const usd = raw.bitcoin?.usd;
    if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) {
      throw new Error('CoinGecko returned no BTC/USD price');
    }
    const now = new Date().toISOString();
    const quote: MarketQuote = {
      btcPriceUsd: usd,
      change24hPct:
        typeof raw.bitcoin?.usd_24h_change === 'number'
          ? raw.bitcoin.usd_24h_change
          : null,
      timestamp: now,
      provider: 'coingecko',
      source: 'LIVE',
      fetchedAt: now,
      stale: false,
    };
    cache.set('market', quote, MARKET_TTL_MS);
    return quote;
  } catch (err) {
    const stale = cache.getStale<MarketQuote>('market');
    if (stale) {
      return { ...stale.value, stale: true };
    }
    throw err;
  }
}

export async function fetchLiveNetworkSnapshot(): Promise<NetworkSnapshot> {
  const fresh = cache.get<NetworkSnapshot>('network');
  if (fresh) return { ...fresh, stale: false };

  try {
    const [hashrate, difficulty, heightRaw] = await Promise.all([
      fetchJsonWithTimeout<MempoolHashrate>(MEMPOOL_HASHRATE, TIMEOUT_MS),
      fetchJsonWithTimeout<MempoolDifficulty>(MEMPOOL_DIFFICULTY, TIMEOUT_MS),
      fetchJsonWithTimeout<number>(MEMPOOL_HEIGHT, TIMEOUT_MS),
    ]);

    const hs = hashrate.currentHashrate;
    if (typeof hs !== 'number' || !Number.isFinite(hs) || hs <= 0) {
      throw new Error('mempool.space returned no network hashrate');
    }

    const height = typeof heightRaw === 'number' ? heightRaw : Number(heightRaw);
    const remainingTime = difficulty.remainingTime;
    const now = new Date().toISOString();
    const snapshot: NetworkSnapshot = {
      networkHashrateEhs: hs / 1e18,
      difficulty:
        typeof hashrate.currentDifficulty === 'number'
          ? hashrate.currentDifficulty
          : null,
      blockHeight: Number.isFinite(height) ? height : null,
      blockSubsidyBtc: Number.isFinite(height) ? blockSubsidyBtc(height) : 3.125,
      blocksPerDay: 144,
      nextDifficultyChangePct:
        typeof difficulty.difficultyChange === 'number'
          ? difficulty.difficultyChange
          : null,
      estimatedRetargetDate:
        typeof difficulty.estimatedRetargetDate === 'number'
          ? new Date(difficulty.estimatedRetargetDate).toISOString()
          : null,
      remainingBlocks:
        typeof difficulty.remainingBlocks === 'number'
          ? difficulty.remainingBlocks
          : null,
      daysUntilAdjustment: estimateDaysUntilAdjustment(
        difficulty.remainingBlocks,
        remainingTime,
      ),
      provider: 'mempool.space',
      source: 'LIVE',
      fetchedAt: now,
      stale: false,
    };
    cache.set('network', snapshot, NETWORK_TTL_MS);
    return snapshot;
  } catch (err) {
    const stale = cache.getStale<NetworkSnapshot>('network');
    if (stale) {
      return { ...stale.value, stale: true };
    }
    throw err;
  }
}

/** Test helper. */
export function clearPublicMarketCache(): void {
  cache.clear();
}
