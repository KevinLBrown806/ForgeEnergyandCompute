import type { MiningSummaryResponse } from '../domain/types';

const EMPTY_SUMMARY: MiningSummaryResponse = {
  ok: false,
  configured: false,
  fetchedAt: null,
  account: null,
  workers: [],
  rewards: [],
  payouts: [],
  error: null,
};

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_FORGE_API_BASE_URL ?? '').replace(/\/$/, '');
  return `${base}${path}`;
}

export async function fetchMiningSummary(
  signal?: AbortSignal,
): Promise<MiningSummaryResponse> {
  try {
    const response = await fetch(apiUrl('/api/mining/summary'), {
      headers: { Accept: 'application/json' },
      signal,
    });
    const body = (await response.json()) as MiningSummaryResponse;
    if (!response.ok && !body.error) {
      return { ...EMPTY_SUMMARY, error: `Forge API returned ${response.status}` };
    }
    return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return {
      ...EMPTY_SUMMARY,
      error: 'Forge API is unavailable',
    };
  }
}
