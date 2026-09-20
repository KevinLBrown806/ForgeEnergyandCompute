import { describe, expect, it } from 'vitest';
import { matchFleetWorkers } from './matching';
import type { MinerAsset, PoolWorker } from './types';

function asset(overrides: Partial<MinerAsset> = {}): MinerAsset {
  return {
    id: 'a1',
    manufacturer: 'Bitmain',
    model: 'S21',
    serialNumber: 'SN-1',
    quantity: 1,
    nominalHashrateTh: 200,
    wattage: 3500,
    efficiencyJTh: 17.5,
    acquisitionDate: null,
    acquisitionCostUsd: null,
    hostingProvider: '',
    facility: '',
    electricityRatePerKwh: null,
    monthlyHostingFeeUsd: null,
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
    hashRateScoringTh: 200,
    hashRate5mTh: 200,
    hashRate60mTh: 200,
    hashRate24hTh: 200,
    shares5m: 1,
    shares60m: 10,
    shares24h: 100,
    ...overrides,
  };
}

describe('Braiins worker matching', () => {
  it('reports matched, unmatched Forge miners, and unmatched workers', () => {
    const report = matchFleetWorkers(
      [
        asset(),
        asset({ id: 'a2', serialNumber: 'SN-2', braiinsWorkerName: 'missing' }),
        asset({ id: 'a3', serialNumber: 'SN-3', braiinsWorkerName: null }),
      ],
      [worker(), worker({ name: 'account.orphan' })],
    );

    expect(report.registeredMiners).toBe(3);
    expect(report.matchedWorkers).toBe(1);
    expect(report.unmatchedForgeMiners.map((a) => a.id)).toEqual(['a2', 'a3']);
    expect(report.unmatchedBraiinsWorkers.map((w) => w.name)).toEqual([
      'account.orphan',
    ]);
  });
});
