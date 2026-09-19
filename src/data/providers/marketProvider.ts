/**
 * Market data provider — BTC spot, network hashrate, block subsidy.
 * Default implementation reads MODELED config; swap for LIVE APIs later.
 */

import { market } from '../../config/forge.config';
import type { DataSource } from '../../domain/dataSource';
import { btcPerThPerDay } from '../../lib/mining';

export interface MarketSnapshot {
  btcPriceUsd: number;
  networkHashrateEhs: number;
  blockSubsidyBtc: number;
  blocksPerDay: number;
  /** Derived: BTC per TH/s per day before pool fees. */
  btcPerThPerDay: number;
  btcPriceSource: DataSource;
  networkSource: DataSource;
  fetchedAt: string | null;
}

export interface MarketProvider {
  getSnapshot(): Promise<MarketSnapshot>;
}

/** Local config market provider — MODELED until spot/difficulty APIs connect. */
export function createLocalMarketProvider(
  overrides?: Partial<MarketSnapshot>,
): MarketProvider {
  return {
    async getSnapshot() {
      const production = btcPerThPerDay(market.network);
      return {
        btcPriceUsd: market.btcPriceUsd,
        networkHashrateEhs: market.network.networkHashrateEhs,
        blockSubsidyBtc: market.network.blockRewardBtc,
        blocksPerDay: market.network.blocksPerDay,
        btcPerThPerDay: production,
        btcPriceSource: market.btcPriceSource,
        networkSource: market.networkSource,
        fetchedAt: null,
        ...overrides,
      };
    },
  };
}
