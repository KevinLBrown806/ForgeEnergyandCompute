/**
 * Facility / host aggregation.
 */

import type { Facility, MinerAsset } from './types';

export interface FacilityAggregate {
  facilityCount: number;
  activeFacilities: number;
  contractedMW: number;
  deployedMW: number;
  minersAtFacilities: number;
}

export function aggregateFacilities(
  facilities: Facility[],
  assets: MinerAsset[] = [],
): FacilityAggregate {
  const active = facilities.filter((f) => f.status === 'active' || f.status === 'contracted');
  const contractedMW = facilities.reduce((s, f) => s + Math.max(0, f.contractedMW), 0);
  const deployedMW = facilities.reduce((s, f) => s + Math.max(0, f.deployedMW), 0);

  const named = new Set(
    facilities.map((f) => f.facilityName.trim().toLowerCase()).filter(Boolean),
  );
  const ids = new Set(facilities.map((f) => f.id));
  const minersAtFacilities = assets.reduce((s, a) => {
    const match =
      (a.facilityId && ids.has(a.facilityId)) ||
      named.has(a.facility.trim().toLowerCase());
    return match ? s + a.quantity : s;
  }, 0);

  return {
    facilityCount: facilities.length,
    activeFacilities: active.length,
    contractedMW,
    deployedMW,
    minersAtFacilities,
  };
}

export function facilityById(
  facilities: Facility[],
  id: string | null | undefined,
): Facility | null {
  if (!id) return null;
  return facilities.find((f) => f.id === id) ?? null;
}
