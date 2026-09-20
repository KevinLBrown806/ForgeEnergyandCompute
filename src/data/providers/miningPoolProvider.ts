/**
 * Mining pool provider — Braiins / pool telemetry.
 * Default implementation uses the existing Forge API client.
 */

import type { MiningSummaryResponse } from '../../domain/types';
import { fetchMiningSummary } from '../../services/forgeApi';

export interface MiningPoolProvider {
  getSummary(signal?: AbortSignal): Promise<MiningSummaryResponse>;
}

/**
 * Mining pool provider backed by the Forge API (Braiins proxy).
 * LIVE when Braiins is configured and the operator is authenticated.
 */
export function createForgeMiningPoolProvider(): MiningPoolProvider {
  return {
    getSummary(signal) {
      return fetchMiningSummary(signal);
    },
  };
}
