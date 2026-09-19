/** Forge API DTOs returned to the browser (no Braiins raw fields). */

export interface PoolWorker {
  name: string;
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

export interface SourceStatus {
  ok: boolean;
  error: string | null;
  /** ISO timestamp of the data used (fresh or stale cache). */
  fetchedAt: string | null;
  /** True when serving last-known-good data after a fetch failure. */
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
  /** Per-upstream status so one failing endpoint cannot wipe the rest. */
  sources: MiningSummarySources | null;
  /** True when any returned field came from soft-expired cache. */
  stale: boolean;
  error: string | null;
  authRequired?: boolean;
  authConfigured?: boolean;
  code?: string;
}
