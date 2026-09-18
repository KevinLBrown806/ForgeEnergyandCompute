/** Raw Braiins Pool API response shapes — server-only. */

export interface BraiinsProfileResponse {
  username?: string;
  btc?: {
    all_time_reward?: string | number;
    hash_rate_unit?: string;
    hash_rate_5m?: number | string;
    hash_rate_60m?: number | string;
    hash_rate_24h?: number | string;
    hash_rate_yesterday?: number | string;
    low_workers?: number;
    off_workers?: number;
    ok_workers?: number;
    dis_workers?: number;
    current_balance?: string | number;
    today_reward?: string | number;
    estimated_reward?: string | number;
    shares_5m?: number;
    shares_60m?: number;
    shares_24h?: number;
    shares_yesterday?: number;
  };
}

export interface BraiinsWorkerRaw {
  state?: string;
  last_share?: number;
  hash_rate_unit?: string;
  hash_rate_scoring?: number;
  hash_rate_5m?: number;
  hash_rate_60m?: number;
  hash_rate_24h?: number;
  shares_5m?: number;
  shares_60m?: number;
  shares_24h?: number;
}

export interface BraiinsWorkersResponse {
  btc?: {
    workers?: Record<string, BraiinsWorkerRaw>;
  };
}

export interface BraiinsDailyRewardRaw {
  date?: number;
  total_reward?: string | number;
  mining_reward?: string | number;
  bos_plus_reward?: string | number;
  referral_bonus?: string | number;
  referral_reward?: string | number;
  calculation_date?: number;
}

export interface BraiinsRewardsResponse {
  btc?: {
    daily_rewards?: BraiinsDailyRewardRaw[];
  };
}

export interface BraiinsOnchainPayoutRaw {
  financial_account_name?: string;
  requested_at_ts?: number;
  resolved_at_ts?: number;
  status?: string;
  amount_sats?: number;
  fee_sats?: number;
  destination?: string;
  tx_id?: string | null;
  trigger_type?: string;
}

export interface BraiinsLightningPayoutRaw {
  financial_account_name?: string;
  requested_at_ts?: number;
  resolved_at_ts?: number;
  status?: string;
  amount_sats?: number;
  fee_sats?: number;
  destination?: string;
  invoice?: string | null;
  preimage?: string | null;
  trigger_type?: string;
}

export interface BraiinsPayoutsResponse {
  onchain?: BraiinsOnchainPayoutRaw[];
  lightning?: BraiinsLightningPayoutRaw[];
}
