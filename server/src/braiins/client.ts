import type {
  BraiinsPayoutsResponse,
  BraiinsProfileResponse,
  BraiinsRewardsResponse,
  BraiinsWorkersResponse,
} from '../types/braiins.js';
import type {
  MiningReward,
  MiningSummaryResponse,
  PoolAccountStats,
  PoolPayout,
  PoolWorker,
} from '../types/domain.js';
import { braiinsCache } from '../services/cache.js';
import {
  normalizePayouts,
  normalizeProfile,
  normalizeRewards,
  normalizeWorkers,
} from './normalize.js';

const BRAIINS_BASE = 'https://pool.braiins.com';
const DEFAULT_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 30_000;
const DEFAULT_REQUEST_INTERVAL_MS = 5_000;

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
  const token = process.env.BRAIINS_API_TOKEN?.trim();
  return token || undefined;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function positiveEnvNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function waitForRequestSlot(): Promise<void> {
  const interval = positiveEnvNumber(
    'BRAIINS_REQUEST_INTERVAL_MS',
    DEFAULT_REQUEST_INTERVAL_MS,
  );
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
  timeoutMs = positiveEnvNumber('BRAIINS_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
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
      throw new BraiinsApiError(`Braiins request failed (${res.status})`, 502, 'braiins_http');
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
      error: 'BRAIINS_API_TOKEN is not configured on the server',
    };
  }

  try {
    const [account, workers, rewards, payouts] = await Promise.all([
      fetchAccountStats(token),
      fetchWorkers(token),
      fetchRewards(token),
      fetchPayouts(token),
    ]);
    return {
      ok: true,
      configured: true,
      fetchedAt: new Date().toISOString(),
      account,
      workers,
      rewards,
      payouts,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof BraiinsApiError ? err.message : 'Unable to reach Braiins Pool';
    return {
      ok: false,
      configured: true,
      fetchedAt: new Date().toISOString(),
      account: null,
      workers: [],
      rewards: [],
      payouts: [],
      error: message,
    };
  }
}

/** Test-only state reset; does not expose or persist credentials. */
export function resetBraiinsClientState(): void {
  nextRequestAt = 0;
  requestQueue = Promise.resolve();
  braiinsCache.clear();
}
