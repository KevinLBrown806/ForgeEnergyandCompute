import { describe, expect, it } from 'vitest';
import { computeTreasury, type TreasuryInputs } from './treasury';

const base: TreasuryInputs = {
  btcHoldings: 42.5,
  avgAcquisitionPriceUsd: 38_500,
  btcPriceUsd: 64_000,
  monthlyAccumulationBtc: 2,
  targetBtc: 250,
};

describe('computeTreasury', () => {
  it('computes current value and cost basis', () => {
    const r = computeTreasury(base);
    expect(r.currentValueUsd).toBeCloseTo(42.5 * 64_000, 3);
    expect(r.costBasisUsd).toBeCloseTo(42.5 * 38_500, 3);
  });

  it('computes unrealized gain in dollars and percent', () => {
    const r = computeTreasury(base);
    expect(r.unrealizedPnlUsd).toBeCloseTo(
      42.5 * 64_000 - 42.5 * 38_500,
      3,
    );
    expect(r.unrealizedPnlPct).toBeCloseTo(64_000 / 38_500 - 1, 6);
  });

  it('projects annual accumulation and target progress', () => {
    const r = computeTreasury(base);
    expect(r.annualAccumulationBtc).toBe(24);
    expect(r.progressToTargetPct).toBeCloseTo(42.5 / 250, 6);
    expect(r.monthsToTarget).toBeCloseTo((250 - 42.5) / 2, 6);
  });

  it('returns null months-to-target when accumulation is zero', () => {
    const r = computeTreasury({ ...base, monthlyAccumulationBtc: 0 });
    expect(r.monthsToTarget).toBeNull();
  });

  it('reports zero months when the target is already met', () => {
    const r = computeTreasury({ ...base, btcHoldings: 300 });
    expect(r.monthsToTarget).toBe(0);
  });
});
