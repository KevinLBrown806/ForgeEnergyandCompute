import { describe, expect, it } from 'vitest';
import { buildFleetRows } from './fleet';
import { buildFleetExceptions } from './exceptions';
import type { MinerAsset, PoolWorker } from './types';

const NOW = Date.parse('2026-09-18T20:00:00.000Z');

function asset(overrides: Partial<MinerAsset> = {}): MinerAsset {
  return {
    id: 'asset-1',
    manufacturer: 'Bitmain',
    model: 'Antminer S21',
    serialNumber: 'S21-001',
    quantity: 1,
    nominalHashrateTh: 200,
    wattage: 3500,
    efficiencyJTh: 17.5,
    acquisitionDate: null,
    acquisitionCostUsd: null,
    hostingProvider: '',
    facility: '',
    electricityRatePerKwh: 0.05,
    monthlyHostingFeeUsd: 0,
    pool: 'Braiins Pool',
    braiinsWorkerName: 'forge.rack-1',
    status: 'active',
    enabled: true,
    warrantyExpiration: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function worker(overrides: Partial<PoolWorker> = {}): PoolWorker {
  return {
    name: 'account.rack-1',
    state: 'ok',
    lastShareAt: '2026-09-18T19:55:00.000Z',
    hashRateUnit: 'TH/s',
    hashRateScoringTh: 390,
    hashRate5mTh: 380,
    hashRate60mTh: 385,
    hashRate24hTh: 390,
    shares5m: 12,
    shares60m: 120,
    shares24h: 2_800,
    ...overrides,
  };
}

describe('fleet exception generation', () => {
  it('emits offline, hashrate-low, unmatched, and efficiency exceptions', () => {
    const assets = [
      asset({ id: 'ok' }),
      asset({
        id: 'low',
        serialNumber: 'LOW',
        braiinsWorkerName: 'low',
        efficiencyJTh: 30,
      }),
      asset({
        id: 'off',
        serialNumber: 'OFF',
        braiinsWorkerName: 'off',
      }),
      asset({
        id: 'unmap',
        serialNumber: 'UNMAP',
        braiinsWorkerName: null,
      }),
    ];
    const rows = buildFleetRows({
      assets,
      workers: [
        worker({ name: 'forge.rack-1' }),
        worker({ name: 'low', hashRate5mTh: 50 }),
        worker({
          name: 'off',
          state: 'off',
          lastShareAt: '2026-09-18T18:00:00.000Z',
        }),
        worker({ name: 'orphan' }),
      ],
      btcPerThPerDay: 0.00000064,
      btcPriceUsd: 64_000,
      poolFeePct: 0.02,
      defaultElectricityRatePerKwh: 0.045,
      nowMs: NOW,
    });

    const exceptions = buildFleetExceptions({
      rows,
      workers: [
        worker({ name: 'forge.rack-1' }),
        worker({ name: 'low', hashRate5mTh: 50 }),
        worker({ name: 'off', state: 'off' }),
        worker({ name: 'orphan' }),
      ],
      efficiencyTargetJTh: 20,
      nowMs: NOW,
    });

    expect(exceptions.some((e) => e.kind === 'HASHRATE_LOW')).toBe(true);
    expect(exceptions.some((e) => e.kind === 'MINER_OFFLINE')).toBe(true);
    expect(exceptions.some((e) => e.kind === 'WORKER_UNMATCHED')).toBe(true);
    expect(exceptions.some((e) => e.kind === 'EFFICIENCY_BELOW_TARGET')).toBe(true);
    expect(exceptions.every((e) => e.timestamp && e.reason)).toBe(true);
  });
});
