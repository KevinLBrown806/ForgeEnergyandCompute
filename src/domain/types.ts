/**
 * Forge domain models.
 * External Braiins/vendor response shapes stay in adapters/server.
 */

export type MinerAssetStatus = 'active' | 'maintenance' | 'spare' | 'retired';

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
  | 'pool_unavailable';

export interface MinerAsset {
  id: string;
  model: string;
  serialNumber: string;
  quantity: number;
  /** Nominal hashrate per unit, TH/s. */
  nominalHashrateTh: number;
  /** Power draw per unit, watts. */
  wattage: number;
  acquisitionDate: string | null;
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

export interface TreasuryPosition {
  btcHoldings: number;
  avgAcquisitionPriceUsd: number;
  monthlyAccumulationBtc: number;
  targetBtc: number;
  source: 'manual';
  updatedAt: string;
}

export interface MiningSummaryResponse {
  ok: boolean;
  configured: boolean;
  fetchedAt: string | null;
  account: PoolAccountStats | null;
  workers: PoolWorker[];
  rewards: MiningReward[];
  payouts: PoolPayout[];
  error: string | null;
}
