/**
 * Freshness model for provider-backed values.
 */

export type FreshnessState = 'LIVE' | 'STALE' | 'FALLBACK' | 'UNAVAILABLE';

export interface FreshnessResult {
  state: FreshnessState;
  lastSuccessAt: string | null;
  ageSeconds: number | null;
  thresholdSeconds: number;
}

export function evaluateFreshness(
  lastSuccessAt: string | null | undefined,
  thresholdSeconds: number,
  opts?: { fallbackActive?: boolean; unavailable?: boolean },
): FreshnessResult {
  if (opts?.unavailable) {
    return {
      state: 'UNAVAILABLE',
      lastSuccessAt: lastSuccessAt ?? null,
      ageSeconds: null,
      thresholdSeconds,
    };
  }
  if (opts?.fallbackActive) {
    return {
      state: 'FALLBACK',
      lastSuccessAt: lastSuccessAt ?? null,
      ageSeconds: lastSuccessAt
        ? Math.max(0, (Date.now() - Date.parse(lastSuccessAt)) / 1000)
        : null,
      thresholdSeconds,
    };
  }
  if (!lastSuccessAt) {
    return {
      state: 'UNAVAILABLE',
      lastSuccessAt: null,
      ageSeconds: null,
      thresholdSeconds,
    };
  }
  const ageSeconds = Math.max(0, (Date.now() - Date.parse(lastSuccessAt)) / 1000);
  if (!Number.isFinite(ageSeconds)) {
    return {
      state: 'UNAVAILABLE',
      lastSuccessAt,
      ageSeconds: null,
      thresholdSeconds,
    };
  }
  return {
    state: ageSeconds <= thresholdSeconds ? 'LIVE' : 'STALE',
    lastSuccessAt,
    ageSeconds,
    thresholdSeconds,
  };
}

/** Default thresholds: market 20m, network 90m, braiins 15m */
export const FRESHNESS_THRESHOLDS = {
  market: 20 * 60,
  network: 90 * 60,
  braiins: 15 * 60,
} as const;
