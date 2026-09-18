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

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_FORGE_API_BASE_URL ?? '').replace(/\/$/, '');
  return `${base}${path}`;
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
