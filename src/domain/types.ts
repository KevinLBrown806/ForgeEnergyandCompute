/**
 * Forge domain models.
 * External Braiins/vendor response shapes stay in adapters/server.
 */

/**
 * Inventory / ledger status for a registered miner asset.
 * Distinct from live pool health (`MinerHealthState`).
 *
 * ORDERED / SHIPPING / DEPLOYING / RETIRED / SOLD / DECOMMISSIONED
 * never contribute to active production.
 * ONLINE production requires an online/active + enabled asset.
 *
 * Legacy values `active` (= online) and `maintenance` (= repair) are kept
 * so stored v1.1 records and existing tests remain valid.
 */
export type MinerAssetStatus =
  | 'active'
  | 'online'
  | 'offline'
  | 'maintenance'
  | 'repair'
  | 'spare'
  | 'retired'
  | 'ordered'
  | 'shipping'
  | 'deploying'
  | 'sold'
  | 'decommissioned';

/** Operational display labels for ledger status (owner-facing). */
export const MINER_ASSET_STATUS_LABEL: Record<MinerAssetStatus, string> = {
  active: 'ONLINE',
  online: 'ONLINE',
  offline: 'OFFLINE',
  maintenance: 'REPAIR',
  repair: 'REPAIR',
  spare: 'SPARE',
  retired: 'RETIRED',
  ordered: 'ORDERED',
  shipping: 'SHIPPING',
  deploying: 'DEPLOYING',
  sold: 'SOLD',
  decommissioned: 'DECOMMISSIONED',
};

/** Statuses that can contribute to live production when enabled. */
export const PRODUCTION_STATUSES: readonly MinerAssetStatus[] = [
  'active',
  'online',
];

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

export type FleetExceptionKind =
  | 'HASHRATE_LOW'
  | 'MINER_OFFLINE'
  | 'WORKER_UNMATCHED'
  | 'NO_RECENT_DATA'
  | 'EFFICIENCY_BELOW_TARGET';

export interface FleetException {
  id: string;
  kind: FleetExceptionKind;
  severity: AlertSeverity;
  miner: string | null;
  minerId: string | null;
  reason: string;
  observedValue: string | null;
  expectedValue: string | null;
  timestamp: string;
}

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
  /** Hardware purchase price per unit or lot, USD. Not an operating expense. */
  acquisitionCostUsd: number | null;
  /** Shipping / freight, USD (lot). */
  shippingCostUsd?: number | null;
  /** Deployment / install cost, USD (lot). */
  deploymentCostUsd?: number | null;
  /** Date the unit was energized (ISO date). */
  deploymentDate?: string | null;
  hostingProvider: string;
  facility: string;
  /** Optional link to a first-class facility record. */
  facilityId?: string | null;
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
  /** Rejected shares in 24h when the pool reports them. */
  rejectedShares24h?: number | null;
  /** Stale shares in 24h when the pool reports them. */
  staleShares24h?: number | null;
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

export type TreasuryTransactionType =
  | 'BTC_MINED'
  | 'BTC_PURCHASE'
  | 'BTC_SALE'
  | 'BTC_TRANSFER_IN'
  | 'BTC_TRANSFER_OUT'
  | 'CASH_CONTRIBUTION'
  | 'CASH_WITHDRAWAL'
  | 'HARDWARE_PURCHASE'
  | 'HOSTING_PAYMENT'
  | 'ELECTRICITY_PAYMENT'
  | 'OTHER_EXPENSE'
  | 'OTHER_INCOME'
  | 'REVERSAL'
  | 'ADJUSTMENT';

export type TreasuryAsset = 'BTC' | 'USD';

export interface TreasuryTransaction {
  id: string;
  date: string;
  transactionType: TreasuryTransactionType;
  asset: TreasuryAsset;
  quantity: number;
  unitPrice: number | null;
  grossAmount: number;
  fee: number;
  counterparty: string;
  account: string;
  minerId: string | null;
  facilityId: string | null;
  memo: string;
  source: 'manual' | 'live' | 'imported';
  externalReference: string | null;
  productionRef?: string | null;
  createdAt: string;
}

export type TreasuryTransactionInput = Omit<TreasuryTransaction, 'createdAt'> & {
  createdAt?: string;
};

export type FacilityStatus = 'active' | 'contracted' | 'planned' | 'ended';

export interface Facility {
  id: string;
  provider: string;
  facilityName: string;
  location: string;
  contractedMW: number;
  deployedMW: number;
  electricityRate: number | null;
  hostingFee: number | null;
  hostingStructure?: string | null;
  term?: string | null;
  agreementStart: string | null;
  agreementEnd: string | null;
  status: FacilityStatus;
  notes: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FacilityInput = Omit<Facility, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type LiabilityKind =
  | 'equipment_financing'
  | 'hosting_payable'
  | 'other';

export interface Liability {
  id: string;
  kind: LiabilityKind;
  label: string;
  amountUsd: number;
  /** Original principal when known (v1.3). */
  originalPrincipalUsd?: number | null;
  /** Outstanding principal when known (v1.3). */
  outstandingPrincipalUsd?: number | null;
  ratePct?: number | null;
  paymentUsd?: number | null;
  maturity?: string | null;
  securedAsset?: string | null;
  counterparty: string;
  notes: string;
  asOf: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LiabilityInput = Omit<Liability, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type CapitalBucketId =
  | 'bitcoin_treasury'
  | 'mining_hardware'
  | 'energy_infrastructure'
  | 'liquidity_cash'
  | 'other';

export interface CapitalAllocationTarget {
  bucket: CapitalBucketId;
  label: string;
  targetPct: number;
}

export interface OwnerAssumptions {
  poolFeePct: number;
  uptimePct: number;
  defaultElectricityRatePerKwh: number;
  efficiencyTargetJTh: number | null;
  monthlyAccumulationBtc: number;
  targetBtc: number;
  otherAssetsUsd: number;
  btcAllocationTargetPct?: number | null;
  miningAllocationTargetPct?: number | null;
  cashAllocationTargetPct?: number | null;
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
