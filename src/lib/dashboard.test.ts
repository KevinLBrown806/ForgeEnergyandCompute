import { describe, expect, it } from 'vitest';
import { capital, energy, fleet, market, treasury } from '../config/forge.config';
import { allocationTotalPct } from './capital';
import { btcPerThPerDay, computeMinerEconomics, summarizeFleet } from './mining';
import { computeTreasury } from './treasury';

describe('dashboard figures from mock config', () => {
  const production = btcPerThPerDay(market.network);
  const ctx = {
    btcPriceUsd: market.btcPriceUsd,
    btcPerThPerDay: production,
    poolFeePct: market.poolFeePct,
    uptimePct: market.uptimePct,
    electricityRatePerKwh: energy.avgElectricityRatePerKwh,
    carbonKgPerKwh: market.carbonKgPerKwh,
  };

  it('counts the sample fleet and only online miners as active', () => {
    const summary = summarizeFleet(fleet, ctx);
    expect(summary.totalMiners).toBe(1100);
    expect(summary.activeMiners).toBe(900);
    expect(summary.activeHashrateTh).toBe(190_200);
    expect(summary.avgEfficiencyJPerTh).toBeCloseTo(3_153_000 / 190_200, 6);
  });

  it('keeps mining cash flow as revenue minus operating cost', () => {
    const summary = summarizeFleet(fleet, ctx);
    expect(summary.monthlyCashFlow).toBeCloseTo(
      summary.monthlyRevenue - summary.monthlyOperatingCost,
      6,
    );
    expect(summary.breakevenBtcPrice).toBeLessThan(market.btcPriceUsd);
    expect(summary.monthlyCashFlow).toBeGreaterThan(0);
  });

  it('values the treasury from holdings and spot price', () => {
    const result = computeTreasury({
      btcHoldings: treasury.btcHoldings,
      avgAcquisitionPriceUsd: treasury.avgAcquisitionPriceUsd,
      btcPriceUsd: market.btcPriceUsd,
      monthlyAccumulationBtc: treasury.monthlyAccumulationBtc,
      targetBtc: treasury.targetBtc,
    });
    expect(result.currentValueUsd).toBeCloseTo(42.5 * 64_000, 3);
    expect(result.unrealizedPnlUsd).toBeGreaterThan(0);
    expect(result.annualAccumulationBtc).toBe(24);
  });

  it('treats provisioning miners as inactive for live production', () => {
    const m60s = fleet.find((m) => m.id === 'm60s');
    expect(m60s).toBeDefined();
    const line = computeMinerEconomics(m60s!, ctx);
    expect(line.active).toBe(false);
  });

  it('keeps capital allocation at 100%', () => {
    expect(allocationTotalPct(capital.slices)).toBeCloseTo(1, 6);
  });
});
