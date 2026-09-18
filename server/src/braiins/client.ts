import type {
  BraiinsPayoutsResponse,
  BraiinsProfileResponse,
  BraiinsRewardsResponse,
  BraiinsWorkersResponse,
} from '../types/braiins.js';
import type {
  MiningReward,
  MiningSummaryResponse,
  MiningSummarySources,
  PoolAccountStats,
  PoolPayout,
  PoolWorker,
  SourceStatus,
} from '../types/domain.js';
import { getEnv } from '../config/env.js';
import { braiinsCache } from '../services/cache.js';
import {
  normalizePayouts,
  normalizeProfile,
  normalizeRewards,
  normalizeWorkers,
} from './normalize.js';

const BRAIINS_BASE = 'https://pool.braiins.com';
const CACHE_TTL_MS = 30_000;

let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

export class BraiinsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = 'braiins_error') {
    super(message);
    this.name = 'BraiinsApiError';
    this.status = status;
    this.code = code;
  }
}

export function getBraiinsToken(): string | undefined {
  return getEnv().braiinsToken;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function waitForRequestSlot(): Promise<void> {
  const interval = getEnv().braiinsRequestIntervalMs;
  const slot = requestQueue.then(async () => {
    const waitMs = Math.max(0, nextRequestAt - Date.now());
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    nextRequestAt = Date.now() + interval;
  });
  requestQueue = slot.catch(() => undefined);
  await slot;
}

export async function braiinsFetch<T>(
  path: string,
  token: string,
  timeoutMs = getEnv().braiinsTimeoutMs,
): Promise<T> {
  await waitForRequestSlot();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BRAIINS_BASE}${path}`, {
      method: 'GET',
      headers: {
        'Pool-Auth-Token': token,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new BraiinsApiError('Braiins authentication failed', 502, 'braiins_auth');
    }
    if (res.status === 429) {
      throw new BraiinsApiError('Braiins rate limit exceeded', 502, 'braiins_rate_limit');
    }
    if (!res.ok) {
      throw new BraiinsApiError(
        `Braiins request failed (${res.status})`,
        502,
        'braiins_http',
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof BraiinsApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new BraiinsApiError('Braiins request timed out', 504, 'braiins_timeout');
    }
    throw new BraiinsApiError('Braiins request failed', 502, 'braiins_network');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAccountStats(token: string): Promise<PoolAccountStats> {
  const cacheKey = 'profile';
  const cached = braiinsCache.get<PoolAccountStats>(cacheKey);
  if (cached) return cached;
  const raw = await braiinsFetch<BraiinsProfileResponse>(
    '/accounts/profile/json/btc/',
    token,
  );
  const normalized = normalizeProfile(raw);
  braiinsCache.set(cacheKey, normalized, CACHE_TTL_MS);
  return normalized;
}

export async function fetchWorkers(token: string): Promise<PoolWorker[]> {
  const cacheKey = 'workers';
  const cached = braiinsCache.get<PoolWorker[]>(cacheKey);
  if (cached) return cached;
  const raw = await braiinsFetch<BraiinsWorkersResponse>(
    '/accounts/workers/json/btc',
    token,
  );
  const normalized = normalizeWorkers(raw);
  braiinsCache.set(cacheKey, normalized, CACHE_TTL_MS);
  return normalized;
}

export async function fetchRewards(
  token: string,
  from?: string,
  to?: string,
): Promise<MiningReward[]> {
  const end = to ?? isoDate(new Date());
  const start =
    from ?? isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const cacheKey = `rewards:${start}:${end}`;
  const cached = braiinsCache.get<MiningReward[]>(cacheKey);
  if (cached) return cached;
  const raw = await braiinsFetch<BraiinsRewardsResponse>(
    `/accounts/rewards/json/btc?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`,
    token,
  );
  const normalized = normalizeRewards(raw);
  braiinsCache.set(cacheKey, normalized, CACHE_TTL_MS);
  return normalized;
}

export async function fetchPayouts(
  token: string,
  from?: string,
  to?: string,
): Promise<PoolPayout[]> {
  const end = to ?? isoDate(new Date());
  const start =
    from ?? isoDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
  const cacheKey = `payouts:${start}:${end}`;
  const cached = braiinsCache.get<PoolPayout[]>(cacheKey);
  if (cached) return cached;
  const raw = await braiinsFetch<BraiinsPayoutsResponse>(
    `/accounts/payouts/json/btc?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`,
    token,
  );
  const normalized = normalizePayouts(raw);
  braiinsCache.set(cacheKey, normalized, CACHE_TTL_MS);
  return normalized;
}

const EMPTY_ACCOUNT: PoolAccountStats = {
  username: null,
  hashRate5mTh: 0,
  hashRate60mTh: 0,
  hashRate24hTh: 0,
  hashRateYesterdayTh: 0,
  okWorkers: 0,
  lowWorkers: 0,
  offWorkers: 0,
  disabledWorkers: 0,
  currentBalanceBtc: 0,
  todayRewardBtc: 0,
  estimatedRewardBtc: 0,
  allTimeRewardBtc: 0,
  updatedAt: null,
};

/**
 * Resolve one Braiins source independently.
 * On failure, serve soft-expired cache when available and report structured status.
 */
async function resolveSource<T>(
  cacheKey: string,
  empty: T,
  load: () => Promise<T>,
): Promise<{ value: T; status: SourceStatus }> {
  try {
    const value = await load();
    return {
      value,
      status: {
        ok: true,
        error: null,
        fetchedAt: new Date().toISOString(),
        stale: false,
      },
    };
  } catch (err) {
    const message =
      err instanceof BraiinsApiError ? err.message : 'Unable to reach Braiins Pool';
    const stale = braiinsCache.getStale<T>(cacheKey);
    if (stale) {
      return {
        value: stale.value,
        status: {
          ok: false,
          error: message,
          fetchedAt: new Date(stale.storedAt).toISOString(),
          stale: true,
        },
      };
    }
    return {
      value: empty,
      status: {
        ok: false,
        error: message,
        fetchedAt: null,
        stale: false,
      },
    };
  }
}

export async function fetchMiningSummary(
  token: string | undefined,
): Promise<MiningSummaryResponse> {
  if (!token) {
    return {
      ok: false,
      configured: false,
      fetchedAt: null,
      account: null,
      workers: [],
      rewards: [],
      payouts: [],
      sources: null,
      stale: false,
      error: 'BRAIINS_API_TOKEN is not configured on the server',
    };
  }

  const end = isoDate(new Date());
  const rewardsStart = isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const payoutsStart = isoDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  // Independent source resolution — payout/reward outages must not erase workers.
  const [profile, workers, rewards, payouts] = await Promise.all([
    resolveSource('profile', EMPTY_ACCOUNT, () => fetchAccountStats(token)),
    resolveSource('workers', [] as PoolWorker[], () => fetchWorkers(token)),
    resolveSource(
      `rewards:${rewardsStart}:${end}`,
      [] as MiningReward[],
      () => fetchRewards(token, rewardsStart, end),
    ),
    resolveSource(
      `payouts:${payoutsStart}:${end}`,
      [] as PoolPayout[],
      () => fetchPayouts(token, payoutsStart, end),
    ),
  ]);

  const sources: MiningSummarySources = {
    profile: profile.status,
    workers: workers.status,
    rewards: rewards.status,
    payouts: payouts.status,
  };

  const usable = (s: SourceStatus) => s.ok || s.stale;
  const anyData =
    usable(sources.profile) ||
    usable(sources.workers) ||
    usable(sources.rewards) ||
    usable(sources.payouts);

  const stale =
    sources.profile.stale ||
    sources.workers.stale ||
    sources.rewards.stale ||
    sources.payouts.stale;

  const errors = [
    sources.profile.error,
    sources.workers.error,
    sources.rewards.error,
    sources.payouts.error,
  ].filter((value): value is string => Boolean(value));

  return {
    ok: anyData,
    configured: true,
    fetchedAt: new Date().toISOString(),
    account: usable(sources.profile) ? profile.value : null,
    workers: usable(sources.workers) ? workers.value : [],
    rewards: usable(sources.rewards) ? rewards.value : [],
    payouts: usable(sources.payouts) ? payouts.value : [],
    sources,
    stale,
    error: errors.length ? `Partial Braiins outage: ${errors.join('; ')}` : null,
  };
}

/** Test-only state reset; does not expose or persist credentials. */
export function resetBraiinsClientState(): void {
  nextRequestAt = 0;
  requestQueue = Promise.resolve();
  braiinsCache.clear();
}
