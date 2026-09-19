/**
 * Stable import surface for Forge data providers.
 *
 * Default implementations consume local config / Forge API.
 * Next phase plugs in LIVE Braiins difficulty, BTC spot, and Found accounting
 * behind these same interfaces.
 */

export {
  createLocalMarketProvider,
  type MarketProvider,
  type MarketSnapshot,
} from './providers/marketProvider';

export {
  createForgeMiningPoolProvider,
  type MiningPoolProvider,
} from './providers/miningPoolProvider';

export {
  createStubAccountingProvider,
  type AccountingProvider,
  type AccountingSnapshot,
} from './providers/accountingProvider';
