import { describe, expect, it } from 'vitest';
import {
  aggregateFleet,
  buildFleetRows,
  buildOperationsAlerts,
  validateMappedMinerQuantity,
  detectDuplicateWorkerMappings,
  findWorkerForAsset,
  workerNamesMatch,
} from './fleet';
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

const economics = {
  btcPerThPerDay: 0.00000064,
  btcPriceUsd: 64_000,
  poolFeePct: 0.02,
  defaultElectricityRatePerKwh: 0.045,
};

describe('fleet matching and health', () => {
  it('matches full names and account-qualified worker suffixes', () => {
    expect(workerNamesMatch('rack-1', 'account.rack-1')).toBe(true);
    expect(workerNamesMatch('ACCOUNT.RACK-1', 'rack-1')).toBe(true);
    expect(workerNamesMatch('rack-1', 'rack-2')).toBe(false);
    expect(findWorkerForAsset(asset(), [worker()])?.name).toBe('account.rack-1');
  });

  it('derives online, degraded, offline, and unmapped rows', () => {
    const assets = [
      asset(),
      asset({ id: 'degraded', braiinsWorkerName: 'degraded' }),
      asset({ id: 'offline', braiinsWorkerName: 'offline' }),
      asset({ id: 'unmapped', braiinsWorkerName: null }),
      asset({ id: 'unknown', braiinsWorkerName: 'unknown' }),
    ];
    const rows = buildFleetRows({
      assets,
      workers: [
        worker(),
        worker({ name: 'degraded', hashRate5mTh: 100 }),
        worker({
          name: 'offline',
          lastShareAt: '2026-09-18T18:00:00.000Z',
        }),
        worker({ name: 'unknown', state: 'unknown' }),
      ],
      ...economics,
      nowMs: NOW,
    });

    expect(rows.map((row) => row.health)).toEqual([
      'ONLINE',
      'DEGRADED',
      'OFFLINE',
      'UNMAPPED',
      'NO_DATA',
    ]);
  });
});

describe('fleet aggregation and alerts', () => {
  it('aggregates physical miner quantities and actual pool telemetry', () => {
    const rows = buildFleetRows({
      assets: [asset()],
      workers: [worker()],
      ...economics,
      nowMs: NOW,
    });
    const result = aggregateFleet({
      rows,
      rewards: [
        {
          date: '2026-09-18T00:00:00.000Z',
          totalRewardBtc: 0.01,
          miningRewardBtc: 0.01,
          bosPlusRewardBtc: 0,
          referralBonusBtc: 0,
          referralRewardBtc: 0,
        },
      ],
      payouts: [],
      unpaidBalanceBtc: 0.02,
      btcEarnedToday: 0.01,
      nowMs: NOW,
    });

    expect(result.registeredMiners).toBe(1);
    expect(result.enabledMiners).toBe(1);
    expect(result.onlineMiners).toBe(1);
    expect(result.currentHashrateTh).toBe(380);
    expect(result.btcEarned7d).toBe(0.01);
  });

  it('excludes ordered and decommissioned machines from active production', () => {
    const rows = buildFleetRows({
      assets: [
        asset(),
        asset({
          id: 'ordered',
          status: 'ordered',
          enabled: false,
          braiinsWorkerName: null,
          quantity: 4,
        }),
        asset({
          id: 'decom',
          status: 'decommissioned',
          enabled: false,
          braiinsWorkerName: null,
          quantity: 2,
        }),
      ],
      workers: [worker()],
      ...economics,
      nowMs: NOW,
    });
    const result = aggregateFleet({
      rows,
      rewards: [],
      payouts: [],
      unpaidBalanceBtc: null,
      btcEarnedToday: null,
      nowMs: NOW,
    });

    expect(result.registeredMiners).toBe(7);
    expect(result.enabledMiners).toBe(1);
    expect(result.expectedHashrateTh).toBe(200);
  });

  it('detects duplicate aliases and unmapped pool workers', () => {
    const duplicateAssets = [
      asset(),
      asset({ id: 'asset-2', braiinsWorkerName: 'rack-1' }),
    ];
    expect(detectDuplicateWorkerMappings(duplicateAssets)).toEqual([
      'forge.rack-1',
    ]);

    const rows = buildFleetRows({
      assets: duplicateAssets,
      workers: [worker(), worker({ name: 'account.orphan' })],
      ...economics,
      nowMs: NOW,
    });
    const alerts = buildOperationsAlerts({
      rows,
      workers: [worker(), worker({ name: 'account.orphan' })],
      poolConfigured: true,
      poolError: null,
      nowMs: NOW,
    });

    expect(alerts.some((alert) => alert.kind === 'duplicate_mapping')).toBe(true);
    expect(alerts.some((alert) => alert.kind === 'unmapped_worker')).toBe(true);
  });
});


describe('mapped miner cardinality', () => {
  it('requires quantity 1 when a Braiins worker is mapped', () => {
    expect(() =>
      validateMappedMinerQuantity({
        quantity: 2,
        braiinsWorkerName: 'forge.rack-1',
      }),
    ).toThrow(/quantity 1/i);
  });

  it('allows quantity > 1 for unmapped inventory groups', () => {
    expect(() =>
      validateMappedMinerQuantity({
        quantity: 4,
        braiinsWorkerName: null,
      }),
    ).not.toThrow();
  });
});
