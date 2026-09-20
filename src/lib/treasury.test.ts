import { describe, expect, it } from 'vitest';
import { computeTreasury, type TreasuryInputs } from './treasury';

const base: TreasuryInputs = {
  btcHoldings: 42.5,
  avgAcquisitionPriceUsd: 38_500,
  btcPriceUsd: 64_000,
  monthlyAccumulationBtc: 2,
  targetBtc: 250,
  cashReserveUsd: 100_000,
  minerHardwareBookValueUsd: 500_000,
  otherAssetsUsd: 50_000,
  liabilitiesUsd: 75_000,
  btcMined: 10,
  btcPurchased: 35,
  btcSold: 2.5,
  btcTransferred: 0,
};

describe('computeTreasury', () => {
  it('computes current value and cost basis', () => {
    const r = computeTreasury(base);
    expect(r.currentValueUsd).toBeCloseTo(42.5 * 64_000, 3);
    expect(r.costBasisUsd).toBeCloseTo(42.5 * 38_500, 3);
  });

  it('uses explicit cost basis when provided', () => {
    const r = computeTreasury({ ...base, btcCostBasisUsd: 1_000_000 });
    expect(r.costBasisUsd).toBe(1_000_000);
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

  it('computes Forge NAV and allocation percentages', () => {
    const r = computeTreasury(base);
    const btcValue = 42.5 * 64_000;
    const assets = btcValue + 100_000 + 500_000 + 50_000;
    expect(r.totalAssetValueUsd).toBeCloseTo(assets, 3);
    expect(r.totalLiabilitiesUsd).toBe(75_000);
    expect(r.forgeNavUsd).toBeCloseTo(assets - 75_000, 3);
    expect(r.btcPctOfNav).toBeCloseTo(btcValue / r.forgeNavUsd, 6);
    expect(r.hardwarePctOfNav).toBeCloseTo(500_000 / r.forgeNavUsd, 6);
    expect(r.cashPctOfNav).toBeCloseTo(100_000 / r.forgeNavUsd, 6);
  });

  it('returns null NAV percentages when NAV is zero or negative', () => {
    const r = computeTreasury({
      ...base,
      btcHoldings: 0,
      cashReserveUsd: 0,
      minerHardwareBookValueUsd: 0,
      otherAssetsUsd: 0,
      liabilitiesUsd: 10,
    });
    expect(r.forgeNavUsd).toBe(-10);
    expect(r.btcPctOfNav).toBeNull();
    expect(r.hardwarePctOfNav).toBeNull();
    expect(r.cashPctOfNav).toBeNull();
  });

  it('preserves BTC movement tracking fields', () => {
    const r = computeTreasury(base);
    expect(r.btcMined).toBe(10);
    expect(r.btcPurchased).toBe(35);
    expect(r.btcSold).toBe(2.5);
    expect(r.btcTransferred).toBe(0);
  });
});
