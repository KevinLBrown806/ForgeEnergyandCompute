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
