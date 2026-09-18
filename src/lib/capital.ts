import type { AllocationSlice } from '../config/forge.config';

export interface CapitalLine extends AllocationSlice {
  usd: number;
}

/** Map allocation fractions onto a total capital figure. */
export function allocateCapital(
  totalUsd: number,
  slices: readonly AllocationSlice[],
): CapitalLine[] {
  return slices.map((slice) => ({
    label: slice.label,
    pct: slice.pct,
    usd: totalUsd * slice.pct,
  }));
}

/** Sum of slice percentages. Callers treat ~1 as a complete allocation. */
export function allocationTotalPct(slices: readonly AllocationSlice[]): number {
  return slices.reduce((sum, slice) => sum + slice.pct, 0);
}
