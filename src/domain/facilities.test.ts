import { describe, expect, it } from 'vitest';
import { aggregateFacilities } from './facilities';
import type { Facility, MinerAsset } from './types';

const facility: Facility = {
  id: 'f1',
  provider: 'Host Co',
  facilityName: 'West 1',
  location: 'TX',
  contractedMW: 10,
  deployedMW: 2.5,
  electricityRate: 0.045,
  hostingFee: 0,
  agreementStart: '2026-01-01',
  agreementEnd: null,
  status: 'active',
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('aggregateFacilities', () => {
  it('sums contracted and deployed MW and counts miners at named sites', () => {
    const assets = [
      {
        id: 'a',
        facility: 'West 1',
        facilityId: 'f1',
        quantity: 3,
      } as MinerAsset,
    ];
    const result = aggregateFacilities([facility], assets);
    expect(result.facilityCount).toBe(1);
    expect(result.activeFacilities).toBe(1);
    expect(result.contractedMW).toBe(10);
    expect(result.deployedMW).toBe(2.5);
    expect(result.minersAtFacilities).toBe(3);
  });
});
