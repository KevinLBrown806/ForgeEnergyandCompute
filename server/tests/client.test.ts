import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BraiinsApiError,
  braiinsFetch,
  fetchMiningSummary,
  fetchWorkers,
  resetBraiinsClientState,
} from '../src/braiins/client.js';

describe('Braiins API client', () => {
  beforeEach(() => {
    process.env.BRAIINS_REQUEST_INTERVAL_MS = '0';
    resetBraiinsClientState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BRAIINS_REQUEST_INTERVAL_MS;
    resetBraiinsClientState();
  });

  it('returns a safe unconfigured summary when the server token is missing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchMiningSummary(undefined);

    expect(result).toMatchObject({
      ok: false,
      configured: false,
      account: null,
      workers: [],
    });
    expect(result.error).toContain('BRAIINS_API_TOKEN');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps upstream HTTP failures to a safe client error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'upstream body' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(fetchWorkers('test-token')).rejects.toMatchObject({
      name: 'BraiinsApiError',
      code: 'braiins_http',
      status: 502,
      message: 'Braiins request failed (503)',
    });
  });

  it('aborts and reports a timeout without exposing credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }),
    );

    const error = await braiinsFetch('/slow', 'test-token', 5).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(BraiinsApiError);
    expect(error).toMatchObject({
      code: 'braiins_timeout',
      status: 504,
      message: 'Braiins request timed out',
    });
    expect(String(error)).not.toContain('test-token');
  });
});

  it('keeps worker telemetry when payouts fail (partial source outage)', async () => {
    const workerPayload = {
      btc: {
        workers: {
          'account.rack-1': {
            state: 'ok',
            last_share: Math.floor(Date.now() / 1000),
            hash_rate_unit: 'Gh/s',
            hash_rate_5m: 380_000,
            hash_rate_60m: 385_000,
            hash_rate_24h: 390_000,
            hash_rate_scoring: 390_000,
            shares_5m: 12,
            shares_60m: 120,
            shares_24h: 2800,
          },
        },
      },
    };
    const profilePayload = {
      username: 'forge',
      btc: {
        hash_rate_unit: 'Gh/s',
        hash_rate_5m: 380_000,
        hash_rate_60m: 385_000,
        hash_rate_24h: 390_000,
        hash_rate_yesterday: 400_000,
        ok_workers: 1,
        low_workers: 0,
        off_workers: 0,
        dis_workers: 0,
        current_balance: 0.01,
        today_reward: 0.001,
        estimated_reward: 0.002,
        all_time_reward: 1.5,
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = String(url);
        if (path.includes('/accounts/profile/')) {
          return new Response(JSON.stringify(profilePayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (path.includes('/accounts/workers/')) {
          return new Response(JSON.stringify(workerPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (path.includes('/accounts/rewards/')) {
          return new Response(JSON.stringify({ btc: { daily_rewards: [] } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Payouts fail independently.
        return new Response(JSON.stringify({ detail: 'payouts down' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const result = await fetchMiningSummary('test-token');

    expect(result.configured).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.workers.length).toBe(1);
    expect(result.account?.username).toBe('forge');
    expect(result.sources?.workers.ok).toBe(true);
    expect(result.sources?.payouts.ok).toBe(false);
    expect(result.sources?.payouts.error).toBeTruthy();
    expect(result.error).toMatch(/outage|payout|fail/i);
  });
