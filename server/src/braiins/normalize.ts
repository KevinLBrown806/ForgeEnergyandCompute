import type {
  BraiinsDailyRewardRaw,
  BraiinsLightningPayoutRaw,
  BraiinsOnchainPayoutRaw,
  BraiinsPayoutsResponse,
  BraiinsProfileResponse,
  BraiinsRewardsResponse,
  BraiinsWorkerRaw,
  BraiinsWorkersResponse,
} from '../types/braiins.js';
import type {
  MiningReward,
  PoolAccountStats,
  PoolPayout,
  PoolWorker,
} from '../types/domain.js';

const SATS_PER_BTC = 100_000_000;

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function satsToBtc(sats: number): number {
  return sats / SATS_PER_BTC;
}

/** Convert Braiins hashrate values to TH/s given the reported unit. */
export function toTh(value: unknown, unit: string | undefined): number {
  const n = toNumber(value);
  const u = (unit ?? 'Gh/s').toLowerCase();
  if (u.startsWith('th')) return n;
  if (u.startsWith('ph')) return n * 1_000;
  if (u.startsWith('eh')) return n * 1_000_000;
  if (u.startsWith('mh')) return n / 1_000_000;
  // Default Braiins unit is Gh/s
  if (u.startsWith('gh')) return n / 1_000;
  return n / 1_000;
}

export function unixToIso(ts: unknown): string | null {
  const n = toNumber(ts, NaN);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toISOString();
}

export function maskDestination(destination: string | null | undefined): string | null {
  if (!destination) return null;
  const d = destination.trim();
  if (d.length <= 10) return `${d.slice(0, 2)}…`;
  if (d.startsWith('bc1') || /^[13]/.test(d)) {
    return `${d.slice(0, 6)}…${d.slice(-4)}`;
  }
  if (d.includes('@')) {
    const [user, host] = d.split('@');
    return `${user.slice(0, 2)}…@${host}`;
  }
  return `${d.slice(0, 6)}…${d.slice(-4)}`;
}

export function normalizeProfile(raw: BraiinsProfileResponse): PoolAccountStats {
  const btc = raw.btc ?? {};
  const unit = btc.hash_rate_unit;
  return {
    username: raw.username ?? null,
    hashRate5mTh: toTh(btc.hash_rate_5m, unit),
    hashRate60mTh: toTh(btc.hash_rate_60m, unit),
    hashRate24hTh: toTh(btc.hash_rate_24h, unit),
    hashRateYesterdayTh: toTh(btc.hash_rate_yesterday, unit),
    okWorkers: toNumber(btc.ok_workers),
    lowWorkers: toNumber(btc.low_workers),
    offWorkers: toNumber(btc.off_workers),
    disabledWorkers: toNumber(btc.dis_workers),
    currentBalanceBtc: toNumber(btc.current_balance),
    todayRewardBtc: toNumber(btc.today_reward),
    estimatedRewardBtc: toNumber(btc.estimated_reward),
    allTimeRewardBtc: toNumber(btc.all_time_reward),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeWorker(name: string, raw: BraiinsWorkerRaw): PoolWorker {
  const unit = raw.hash_rate_unit;
  return {
    name,
    state: (raw.state ?? 'unknown').toLowerCase(),
    lastShareAt: unixToIso(raw.last_share),
    hashRateUnit: 'TH/s',
    hashRateScoringTh: toTh(raw.hash_rate_scoring, unit),
    hashRate5mTh: toTh(raw.hash_rate_5m, unit),
    hashRate60mTh: toTh(raw.hash_rate_60m, unit),
    hashRate24hTh: toTh(raw.hash_rate_24h, unit),
    shares5m: toNumber(raw.shares_5m),
    shares60m: toNumber(raw.shares_60m),
    shares24h: toNumber(raw.shares_24h),
    rejectedShares24h:
      raw.rejected_shares_24h != null ? toNumber(raw.rejected_shares_24h) : null,
    staleShares24h:
      raw.stale_shares_24h != null ? toNumber(raw.stale_shares_24h) : null,
  };
}

export function normalizeWorkers(raw: BraiinsWorkersResponse): PoolWorker[] {
  const workers = raw.btc?.workers ?? {};
  return Object.entries(workers).map(([name, w]) => normalizeWorker(name, w ?? {}));
}

export function normalizeReward(raw: BraiinsDailyRewardRaw): MiningReward {
  return {
    date: unixToIso(raw.date) ?? new Date(0).toISOString(),
    totalRewardBtc: toNumber(raw.total_reward),
    miningRewardBtc: toNumber(raw.mining_reward),
    bosPlusRewardBtc: toNumber(raw.bos_plus_reward),
    referralBonusBtc: toNumber(raw.referral_bonus),
    referralRewardBtc: toNumber(raw.referral_reward),
  };
}

export function normalizeRewards(raw: BraiinsRewardsResponse): MiningReward[] {
  return (raw.btc?.daily_rewards ?? []).map(normalizeReward);
}

function normalizeOnchain(raw: BraiinsOnchainPayoutRaw, index: number): PoolPayout {
  return {
    id: raw.tx_id || `onchain-${raw.requested_at_ts ?? index}`,
    channel: 'onchain',
    status: (raw.status ?? 'unknown').toLowerCase(),
    amountBtc: satsToBtc(toNumber(raw.amount_sats)),
    feeBtc: satsToBtc(toNumber(raw.fee_sats)),
    requestedAt: unixToIso(raw.requested_at_ts),
    resolvedAt: unixToIso(raw.resolved_at_ts),
    destinationMasked: maskDestination(raw.destination),
    triggerType: raw.trigger_type ?? null,
  };
}

function normalizeLightning(raw: BraiinsLightningPayoutRaw, index: number): PoolPayout {
  return {
    id: `lightning-${raw.requested_at_ts ?? index}`,
    channel: 'lightning',
    status: (raw.status ?? 'unknown').toLowerCase(),
    amountBtc: satsToBtc(toNumber(raw.amount_sats)),
    feeBtc: satsToBtc(toNumber(raw.fee_sats)),
    requestedAt: unixToIso(raw.requested_at_ts),
    resolvedAt: unixToIso(raw.resolved_at_ts),
    destinationMasked: maskDestination(raw.destination),
    triggerType: raw.trigger_type ?? null,
  };
}

export function normalizePayouts(raw: BraiinsPayoutsResponse): PoolPayout[] {
  const onchain = (raw.onchain ?? []).map(normalizeOnchain);
  const lightning = (raw.lightning ?? []).map(normalizeLightning);
  return [...onchain, ...lightning].sort((a, b) => {
    const ta = Date.parse(a.resolvedAt ?? a.requestedAt ?? '') || 0;
    const tb = Date.parse(b.resolvedAt ?? b.requestedAt ?? '') || 0;
    return tb - ta;
  });
}
