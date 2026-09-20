import type { MiningSummaryResponse } from '../domain/types';

export interface AuthSession {
  authenticated: boolean;
  authConfigured: boolean;
  braiinsConfigured: boolean;
  authRequired: boolean;
}

const EMPTY_SUMMARY: MiningSummaryResponse = {
  ok: false,
  configured: false,
  fetchedAt: null,
  account: null,
  workers: [],
  rewards: [],
  payouts: [],
  sources: null,
  stale: false,
  error: null,
};

/**
 * Resolve a Forge API path for fetch().
 * Default (unset / empty base): same-origin relative `/api/...` (Netlify proxy or Vite proxy).
 * Optional `VITE_FORGE_API_BASE_URL`: absolute origin override for local/preview/alternate topology.
 */
export function resolveForgeApiUrl(
  path: string,
  baseUrl: string | undefined = import.meta.env.VITE_FORGE_API_BASE_URL as
    | string
    | undefined,
): string {
  const base = (baseUrl ?? '').trim().replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

function apiUrl(path: string): string {
  return resolveForgeApiUrl(path);
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export async function fetchAuthSession(
  signal?: AbortSignal,
): Promise<AuthSession> {
  try {
    const response = await apiFetch('/api/auth/session', { signal });
    if (!response.ok) {
      return {
        authenticated: false,
        authConfigured: false,
        braiinsConfigured: false,
        authRequired: false,
      };
    }
    return (await response.json()) as AuthSession;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return {
      authenticated: false,
      authConfigured: false,
      braiinsConfigured: false,
      authRequired: false,
    };
  }
}

export async function loginOperator(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      return { ok: false, error: body.error ?? `Login failed (${response.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Forge API is unavailable' };
  }
}

export async function logoutOperator(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Best-effort logout; cookie may already be cleared server-side.
  }
}

export interface MarketSnapshotResponse {
  ok: boolean;
  btcPriceUsd: number | null;
  change24hPct: number | null;
  timestamp: string | null;
  provider: string;
  source: string;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

export interface NetworkSnapshotResponse {
  ok: boolean;
  networkHashrateEhs: number | null;
  difficulty: number | null;
  blockHeight: number | null;
  blockSubsidyBtc: number | null;
  blocksPerDay: number | null;
  nextDifficultyChangePct: number | null;
  estimatedRetargetDate: string | null;
  remainingBlocks: number | null;
  daysUntilAdjustment: number | null;
  provider: string;
  source: string;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

export async function fetchMarketSnapshot(
  signal?: AbortSignal,
): Promise<MarketSnapshotResponse> {
  try {
    const response = await apiFetch('/api/market/snapshot', { signal });
    const body = (await response.json()) as MarketSnapshotResponse;
    return {
      ok: Boolean(body.ok),
      btcPriceUsd: body.btcPriceUsd ?? null,
      change24hPct: body.change24hPct ?? null,
      timestamp: body.timestamp ?? null,
      provider: body.provider ?? 'coingecko',
      source: body.source ?? 'MODELED',
      fetchedAt: body.fetchedAt ?? null,
      stale: Boolean(body.stale),
      error: body.error ?? (response.ok ? null : `Forge API returned ${response.status}`),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return {
      ok: false,
      btcPriceUsd: null,
      change24hPct: null,
      timestamp: null,
      provider: 'coingecko',
      source: 'MODELED',
      fetchedAt: null,
      stale: false,
      error: 'Forge API is unavailable',
    };
  }
}

export async function fetchNetworkSnapshot(
  signal?: AbortSignal,
): Promise<NetworkSnapshotResponse> {
  try {
    const response = await apiFetch('/api/network/snapshot', { signal });
    const body = (await response.json()) as NetworkSnapshotResponse;
    return {
      ok: Boolean(body.ok),
      networkHashrateEhs: body.networkHashrateEhs ?? null,
      difficulty: body.difficulty ?? null,
      blockHeight: body.blockHeight ?? null,
      blockSubsidyBtc: body.blockSubsidyBtc ?? null,
      blocksPerDay: body.blocksPerDay ?? 144,
      nextDifficultyChangePct: body.nextDifficultyChangePct ?? null,
      estimatedRetargetDate: body.estimatedRetargetDate ?? null,
      remainingBlocks: body.remainingBlocks ?? null,
      daysUntilAdjustment: body.daysUntilAdjustment ?? null,
      provider: body.provider ?? 'mempool.space',
      source: body.source ?? 'MODELED',
      fetchedAt: body.fetchedAt ?? null,
      stale: Boolean(body.stale),
      error: body.error ?? (response.ok ? null : `Forge API returned ${response.status}`),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return {
      ok: false,
      networkHashrateEhs: null,
      difficulty: null,
      blockHeight: null,
      blockSubsidyBtc: null,
      blocksPerDay: 144,
      nextDifficultyChangePct: null,
      estimatedRetargetDate: null,
      remainingBlocks: null,
      daysUntilAdjustment: null,
      provider: 'mempool.space',
      source: 'MODELED',
      fetchedAt: null,
      stale: false,
      error: 'Forge API is unavailable',
    };
  }
}

export async function fetchMiningSummary(
  signal?: AbortSignal,
): Promise<MiningSummaryResponse> {
  try {
    const response = await apiFetch('/api/mining/summary', { signal });
    const body = (await response.json()) as MiningSummaryResponse;
    if (!response.ok && !body.error) {
      return { ...EMPTY_SUMMARY, error: `Forge API returned ${response.status}` };
    }
    return {
      ...EMPTY_SUMMARY,
      ...body,
      sources: body.sources ?? null,
      stale: Boolean(body.stale),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return {
      ...EMPTY_SUMMARY,
      error: 'Forge API is unavailable',
    };
  }
}
