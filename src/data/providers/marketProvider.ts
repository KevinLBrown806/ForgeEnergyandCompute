/**
 * Market data provider — BTC spot.
 * LIVE quotes come from the Forge API proxy (CoinGecko). On failure,
 * last-known-good cache is used; otherwise MODELED config.
 */

import { market } from '../../config/forge.config';
import { DataSource, type DataSource as DataSourceT } from '../../domain/dataSource';
import { btcPerThPerDay } from '../../lib/mining';
import { fetchMarketSnapshot } from '../../services/forgeApi';
import type { NetworkSnapshot } from './networkProvider';

export interface MarketSnapshot {
  btcPriceUsd: number;
  change24hPct: number | null;
  networkHashrateEhs: number;
  difficulty: number | null;
  blockHeight: number | null;
  blockSubsidyBtc: number;
  blocksPerDay: number;
  nextDifficultyChangePct: number | null;
  daysUntilAdjustment: number | null;
  estimatedRetargetDate: string | null;
  /** Derived: BTC per TH/s per day before pool fees. */
  btcPerThPerDay: number;
  btcPriceSource: DataSourceT;
  networkSource: DataSourceT;
  priceProvider: string;
  networkProvider: string;
  fetchedAt: string | null;
  priceUpdatedAt: string | null;
  stale: boolean;
}

export interface MarketQuote {
  btcPriceUsd: number;
  change24hPct: number | null;
  timestamp: string | null;
  provider: string;
  source: DataSourceT;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

export interface MarketProvider {
  getSnapshot(): Promise<MarketSnapshot>;
  getQuote(): Promise<MarketQuote>;
}

const PRICE_CACHE_KEY = 'forge.market.quote.v1';

function readCachedQuote(): MarketQuote | null {
  try {
    const raw = localStorage.getItem(PRICE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MarketQuote;
  } catch {
    return null;
  }
}

function writeCachedQuote(quote: MarketQuote): void {
  try {
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(quote));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function modeledMarketQuote(): MarketQuote {
  return {
    btcPriceUsd: market.btcPriceUsd,
    change24hPct: null,
    timestamp: null,
    provider: 'forge.config',
    source: DataSource.MODELED,
    fetchedAt: null,
    stale: false,
    error: null,
  };
}

export function modeledMarketSnapshot(
  network?: Partial<NetworkSnapshot>,
): MarketSnapshot {
  const production = btcPerThPerDay({
    networkHashrateEhs: network?.networkHashrateEhs ?? market.network.networkHashrateEhs,
    blockRewardBtc: network?.blockSubsidyBtc ?? market.network.blockRewardBtc,
    blocksPerDay: network?.blocksPerDay ?? market.network.blocksPerDay,
  });
  return {
    btcPriceUsd: market.btcPriceUsd,
    change24hPct: null,
    networkHashrateEhs: network?.networkHashrateEhs ?? market.network.networkHashrateEhs,
    difficulty: network?.difficulty ?? null,
    blockHeight: network?.blockHeight ?? null,
    blockSubsidyBtc: network?.blockSubsidyBtc ?? market.network.blockRewardBtc,
    blocksPerDay: network?.blocksPerDay ?? market.network.blocksPerDay,
    nextDifficultyChangePct: network?.nextDifficultyChangePct ?? null,
    daysUntilAdjustment: network?.daysUntilAdjustment ?? null,
    estimatedRetargetDate: network?.estimatedRetargetDate ?? null,
    btcPerThPerDay: production,
    btcPriceSource: market.btcPriceSource,
    networkSource: network?.source ?? market.networkSource,
    priceProvider: 'forge.config',
    networkProvider: network?.provider ?? 'forge.config',
    fetchedAt: network?.fetchedAt ?? null,
    priceUpdatedAt: null,
    stale: false,
  };
}

export function mergeMarketSnapshot(
  quote: MarketQuote,
  network: NetworkSnapshot,
): MarketSnapshot {
  const production = btcPerThPerDay({
    networkHashrateEhs: network.networkHashrateEhs,
    blockRewardBtc: network.blockSubsidyBtc,
    blocksPerDay: network.blocksPerDay,
  });
  return {
    btcPriceUsd: quote.btcPriceUsd,
    change24hPct: quote.change24hPct,
    networkHashrateEhs: network.networkHashrateEhs,
    difficulty: network.difficulty,
    blockHeight: network.blockHeight,
    blockSubsidyBtc: network.blockSubsidyBtc,
    blocksPerDay: network.blocksPerDay,
    nextDifficultyChangePct: network.nextDifficultyChangePct,
    daysUntilAdjustment: network.daysUntilAdjustment,
    estimatedRetargetDate: network.estimatedRetargetDate,
    btcPerThPerDay: production,
    btcPriceSource: quote.source,
    networkSource: network.source,
    priceProvider: quote.provider,
    networkProvider: network.provider,
    fetchedAt: quote.fetchedAt ?? network.fetchedAt,
    priceUpdatedAt: quote.fetchedAt,
    stale: quote.stale || network.stale,
  };
}

/** Local config market provider — MODELED until live feeds succeed. */
export function createLocalMarketProvider(
  overrides?: Partial<MarketSnapshot>,
): MarketProvider {
  return {
    async getSnapshot() {
      return { ...modeledMarketSnapshot(), ...overrides };
    },
    async getQuote() {
      return modeledMarketQuote();
    },
  };
}

/**
 * Forge API-backed market provider with last-known-good + MODELED fallback.
 */
export function createForgeMarketProvider(): MarketProvider {
  return {
    async getQuote() {
      const live = await fetchMarketSnapshot();
      if (live.ok && live.btcPriceUsd != null && live.btcPriceUsd > 0) {
        const quote: MarketQuote = {
          btcPriceUsd: live.btcPriceUsd,
          change24hPct: live.change24hPct,
          timestamp: live.timestamp,
          provider: live.provider,
          source: DataSource.LIVE,
          fetchedAt: live.fetchedAt,
          stale: live.stale,
          error: null,
        };
        writeCachedQuote(quote);
        return quote;
      }
      const cached = readCachedQuote();
      if (cached && cached.btcPriceUsd > 0) {
        return { ...cached, stale: true, error: live.error };
      }
      return { ...modeledMarketQuote(), error: live.error };
    },
    async getSnapshot() {
      const quote = await this.getQuote();
      return mergeMarketSnapshot(quote, {
        networkHashrateEhs: market.network.networkHashrateEhs,
        difficulty: null,
        blockHeight: null,
        blockSubsidyBtc: market.network.blockRewardBtc,
        blocksPerDay: market.network.blocksPerDay,
        nextDifficultyChangePct: null,
        daysUntilAdjustment: null,
        estimatedRetargetDate: null,
        remainingBlocks: null,
        provider: 'forge.config',
        source: DataSource.MODELED,
        fetchedAt: null,
        stale: false,
        error: null,
      });
    },
  };
}
