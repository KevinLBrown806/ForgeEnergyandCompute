import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from '../../domain/dataSource';
import { market } from '../../config/forge.config';

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  });
});

vi.mock('../../services/forgeApi', () => ({
  fetchMarketSnapshot: vi.fn(),
}));

import { fetchMarketSnapshot } from '../../services/forgeApi';
import {
  createForgeMarketProvider,
  mergeMarketSnapshot,
  modeledMarketQuote,
} from './marketProvider';
import { modeledNetworkSnapshot } from './networkProvider';

describe('market provider fallback', () => {
  afterEach(() => {
    vi.mocked(fetchMarketSnapshot).mockReset();
    localStorage.clear();
  });

  it('marks a successful quote LIVE and caches it', async () => {
    vi.mocked(fetchMarketSnapshot).mockResolvedValue({
      ok: true,
      btcPriceUsd: 70_000,
      change24hPct: 1.5,
      timestamp: '2026-09-20T00:00:00.000Z',
      provider: 'coingecko',
      source: 'LIVE',
      fetchedAt: '2026-09-20T00:00:00.000Z',
      stale: false,
      error: null,
    });

    const quote = await createForgeMarketProvider().getQuote();
    expect(quote.source).toBe(DataSource.LIVE);
    expect(quote.btcPriceUsd).toBe(70_000);
    expect(quote.change24hPct).toBe(1.5);
  });

  it('falls back to last-known LIVE cache, then MODELED config', async () => {
    vi.mocked(fetchMarketSnapshot).mockResolvedValue({
      ok: true,
      btcPriceUsd: 71_000,
      change24hPct: 0,
      timestamp: '2026-09-20T00:00:00.000Z',
      provider: 'coingecko',
      source: 'LIVE',
      fetchedAt: '2026-09-20T00:00:00.000Z',
      stale: false,
      error: null,
    });
    const provider = createForgeMarketProvider();
    await provider.getQuote();

    vi.mocked(fetchMarketSnapshot).mockResolvedValue({
      ok: false,
      btcPriceUsd: null,
      change24hPct: null,
      timestamp: null,
      provider: 'coingecko',
      source: 'MODELED',
      fetchedAt: null,
      stale: false,
      error: 'timeout',
    });
    const cached = await provider.getQuote();
    expect(cached.btcPriceUsd).toBe(71_000);
    expect(cached.stale).toBe(true);

    localStorage.clear();
    const modeled = await provider.getQuote();
    expect(modeled.source).toBe(DataSource.MODELED);
    expect(modeled.btcPriceUsd).toBe(market.btcPriceUsd);
  });

  it('merges live price with modeled network without claiming network is LIVE', () => {
    const snap = mergeMarketSnapshot(modeledMarketQuote(), modeledNetworkSnapshot());
    expect(snap.btcPriceSource).toBe(DataSource.MODELED);
    expect(snap.networkSource).toBe(DataSource.MODELED);
    expect(snap.btcPerThPerDay).toBeGreaterThan(0);
  });
});
