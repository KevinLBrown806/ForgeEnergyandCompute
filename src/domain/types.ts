/**
 * Forge domain models.
 * External Braiins/vendor response shapes stay in adapters/server.
 */

/**
 * Inventory / ledger status for a registered miner asset.
 * Distinct from live pool health (`MinerHealthState`).
 *
 * ORDERED / DECOMMISSIONED never contribute to active production.
 * REPAIR maps to maintenance; ONLINE production requires active + enabled.
 */
export type MinerAssetStatus =
  | 'active'
  | 'maintenance'
  | 'spare'
  | 'retired'
  | 'ordered'
  | 'decommissioned';

/** Operational display labels for ledger status (owner-facing). */
export const MINER_ASSET_STATUS_LABEL: Record<MinerAssetStatus, string> = {
  active: 'ONLINE',
  maintenance: 'REPAIR',
  spare: 'SPARE',
  retired: 'DECOMMISSIONED',
  ordered: 'ORDERED',
  decommissioned: 'DECOMMISSIONED',
};

export type MinerHealthState =
  | 'ONLINE'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'NO_DATA'
  | 'UNMAPPED';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertKind =
  | 'worker_offline'
  | 'hashrate_trailing'
  | 'stale_shares'
  | 'unmapped_miner'
  | 'unmapped_worker'
  | 'duplicate_mapping'
  | 'pool_unavailable'
  | 'pool_degraded'
  | 'auth_required'
  | 'stale_telemetry';

export interface MinerAsset {
  id: string;
  /** Manufacturer, e. and Bitmain / MicroBT. */
  manufacturer: string;
  model: string;
  /** Primary serial (required for registry UX). */
  serialNumber: string;
  /** Optional additional serials for multi-unit groups. */
  serialNumbers?: string[];
  quantity: number;
  /** Nominal hashrate per unit, TH/s. */
  nominalHashrateTh: number;
  /** Power draw per unit, watts. */
  wattage: number;
  /**
   * Efficiency J/TH when known from datasheet.
   * If null, derived as wattage / nominalHashrateTh.
   */
  efficiencyJTh: number | null;
  /** Purchase / acquisition date (ISO date). */
  acquisitionDate: string | null;
  /** Purchase price per unit or lot, USD. */
  acquisitionCostUsd: number | null;
  hostingProvider: string;
  facility: string;
  electricityRatePerKwh: number | null;
  monthlyHostingFeeUsd: number | null;
  pool: string;
  braiinsWorkerName: string | null;
  status: MinerAssetStatus;
  enabled: boolean;
  warrantyExpiration: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type MinerAssetInput = Omit<MinerAsset, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export interface PoolWorker {
  name: string;
  /** ok | low | off | dis | unknown */
  state: string;
  lastShareAt: string | null;
  hashRateUnit: string;
  hashRateScoringTh: number;
  hashRate5mTh: number;
  hashRate60mTh: number;
  hashRate24hTh: number;
  shares5m: number;
  shares60m: number;
  shares24h: number;
}

export interface MiningReward {
  date: string;
  totalRewardBtc: number;
  miningRewardBtc: number;
  bosPlusRewardBtc: number;
  referralBonusBtc: number;
  referralRewardBtc: number;
}

export interface PoolPayout {
  id: string;
  channel: 'onchain' | 'lightning';
  status: string;
  amountBtc: number;
  feeBtc: number;
  requestedAt: string | null;
  resolvedAt: string | null;
  destinationMasked: string | null;
  triggerType: string | null;
}

export interface PoolAccountStats {
  username: string | null;
  hashRate5mTh: number;
  hashRate60mTh: number;
  hashRate24hTh: number;
  hashRateYesterdayTh: number;
  okWorkers: number;
  lowWorkers: number;
  offWorkers: number;
  disabledWorkers: number;
  currentBalanceBtc: number;
  todayRewardBtc: number;
  estimatedRewardBtc: number;
  allTimeRewardBtc: number;
  updatedAt: string | null;
}

export interface MiningTelemetry {
  asset: MinerAsset;
  worker: PoolWorker | null;
  health: MinerHealthState;
  expectedHashrateTh: number;
  live5mTh: number | null;
  live60mTh: number | null;
  live24hTh: number | null;
  pctOfExpected: number | null;
  lastShareAt: string | null;
  workerState: string | null;
}

export interface MiningEconomics {
  btcPerDay: number;
  estimatedRevenuePerDayUsd: number;
  estimatedRevenuePerMonthUsd: number;
  operatingCostPerDayUsd: number;
  operatingCostPerMonthUsd: number;
  netContributionPerDayUsd: number;
  netContributionPerMonthUsd: number;
  revenuePerThUsd: number | null;
  costPerBtcUsd: number | null;
}

export interface FleetRow extends MiningTelemetry {
  economics: MiningEconomics;
}

export interface FleetAggregate {
  registeredMiners: number;
  enabledMiners: number;
  onlineMiners: number;
  offlineMiners: number;
  degradedMiners: number;
  unmappedMiners: number;
  expectedHashrateTh: number;
  currentHashrateTh: number;
  average24hHashrateTh: number;
  fleetEfficiencyPct: number | null;
  btcEarnedToday: number | null;
  btcEarned7d: number | null;
  btcEarned30d: number | null;
  estimatedMonthlyBtc: number;
  lastPayout: PoolPayout | null;
  unpaidBalanceBtc: number | null;
  grossMiningRevenueMonthlyUsd: number;
  operatingExpensesMonthlyUsd: number;
  miningContributionMonthlyUsd: number;
  revenuePerThUsd: number | null;
  costPerBtcUsd: number | null;
}

export interface OperationsAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  assetId: string | null;
  workerName: string | null;
}

/**
 * Manual Forge treasury ledger.
 * Cost basis and NAV fields are independent of mining production math.
 */
export interface TreasuryPosition {
  /** Total BTC currently held (wallet / custody). */
  btcHoldings: number;
  /** Average USD cost basis per BTC held. */
  avgAcquisitionPriceUsd: number;
  /** BTC accumulated via mining (lifetime / tracked). */
  btcMined: number;
  /** BTC purchased on market. */
  btcPurchased: number;
  /** BTC sold. */
  btcSold: number;
  /** BTC transferred in/out (net; positive = in). */
  btcTransferred: number;
  /** Explicit total BTC cost basis in USD (overrides holdings × avg when set). */
  btcCostBasisUsd: number | null;
  /** USD cash / dry powder. */
  cashReserveUsd: number;
  /** Miner hardware book value (USD). */
  minerHardwareBookValueUsd: number;
  /** Other assets (USD). */
  otherAssetsUsd: number;
  /** Total liabilities (USD). */
  liabilitiesUsd: number;
  /** Expected net BTC added per month (manual planning rate). */
  monthlyAccumulationBtc: number;
  targetBtc: number;
  source: 'manual';
  updatedAt: string;
}

export interface SourceStatus {
  ok: boolean;
  error: string | null;
  fetchedAt: string | null;
  stale: boolean;
}

export interface MiningSummarySources {
  profile: SourceStatus;
  workers: SourceStatus;
  rewards: SourceStatus;
  payouts: SourceStatus;
}

export interface MiningSummaryResponse {
  ok: boolean;
  configured: boolean;
  fetchedAt: string | null;
  account: PoolAccountStats | null;
  workers: PoolWorker[];
  rewards: MiningReward[];
  payouts: PoolPayout[];
  sources: MiningSummarySources | null;
  stale: boolean;
  error: string | null;
  authRequired?: boolean;
  authConfigured?: boolean;
  code?: string;
}
