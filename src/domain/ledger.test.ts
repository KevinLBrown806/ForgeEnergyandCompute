import { describe, expect, it } from 'vitest';
import type { MinerAsset } from './types';
import {
  aggregateFleetCapital,
  minerTotalCostBasisUsd,
} from './ledger';
import { findDuplicateSerial, validateMinerAsset } from './validation';

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
    acquisitionDate: '2026-01-01',
    acquisitionCostUsd: 4000,
    shippingCostUsd: 200,
    deploymentCostUsd: 300,
    deploymentDate: '2026-02-01',
    hostingProvider: 'Host',
    facility: 'Site A',
    electricityRatePerKwh: 0.045,
    monthlyHostingFeeUsd: 0,
    pool: 'Braiins Pool',
    braiinsWorkerName: null,
    status: 'online',
    enabled: true,
    warrantyExpiration: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('miner cost basis', () => {
  it('sums hardware, shipping, and deployment without treating them as opex', () => {
    expect(minerTotalCostBasisUsd(asset())).toBe(4500);
    expect(minerTotalCostBasisUsd(asset({ quantity: 2, acquisitionCostUsd: 4000 }))).toBe(
      8500,
    );
    expect(
      minerTotalCostBasisUsd(
        asset({
          acquisitionCostUsd: null,
          shippingCostUsd: null,
          deploymentCostUsd: null,
        }),
      ),
    ).toBeNull();
  });

  it('aggregates owned fleet capital and excludes sold machines', () => {
    const totals = aggregateFleetCapital([
      asset(),
      asset({ id: 'sold', serialNumber: 'SN-2', status: 'sold', enabled: false }),
    ]);
    expect(totals.minersOwned).toBe(1);
    expect(totals.machinesOnline).toBe(1);
    expect(totals.totalDeployedCapitalUsd).toBe(4500);
    expect(totals.originalHardwareCostUsd).toBe(4000);
  });
});

describe('duplicate serial protection', () => {
  it('rejects a colliding serial on another asset', () => {
    expect(
      findDuplicateSerial(asset({ id: 'new', serialNumber: 'SN-1' }), [asset()]),
    ).toBe('sn-1');
    expect(() =>
      validateMinerAsset(asset({ id: 'new', serialNumber: 'SN-1' }), [asset()]),
    ).toThrow(/already registered/i);
  });

  it('allows the same serial on the same id during update', () => {
    expect(findDuplicateSerial(asset(), [asset()])).toBeNull();
  });
});
