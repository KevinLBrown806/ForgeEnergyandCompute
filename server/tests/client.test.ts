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
