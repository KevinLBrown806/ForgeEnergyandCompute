import { describe, expect, it } from 'vitest';
import {
  aggregateFleetProjection,
  btcDenominatedRoiAnnual,
  btcPerThPerDay,
  computeMining,
  costToMineOneBtcUsd,
  minerHostingCostUsdPerMonth,
  minerMonthlyBtcProduction,
  minerPowerCostUsdPerMonth,
  minerRevenueUsdPerMonth,
  projectMinerLine,
  simpleHardwareRoiAnnual,
  summarizeFleet,
  type FleetContext,
  type LedgerMinerInput,
  type MiningInputs,
} from './mining';
import type { MinerModel } from '../config/forge.config';

const baseInputs: MiningInputs = {
  minerCount: 1,
  hashratePerMinerTh: 100,
  wattsPerMiner: 3000,
  electricityRatePerKwh: 0.05,
  btcPriceUsd: 60_000,
  btcPerThPerDay: 1e-6,
  poolFeePct: 0,
  uptimePct: 1,
};

describe('btcPerThPerDay', () => {
  it('derives production from network parameters', () => {
    const value = btcPerThPerDay({
      networkHashrateEhs: 700,
      blockRewardBtc: 3.125,
      blocksPerDay: 144,
    });
    expect(value).toBeCloseTo((3.125 * 144) / 700e6, 15);
  });

  it('returns 0 for a zero network', () => {
    expect(
      btcPerThPerDay({
        networkHashrateEhs: 0,
        blockRewardBtc: 3.125,
        blocksPerDay: 144,
      }),
    ).toBe(0);
  });
});

describe('computeMining', () => {
  it('computes hashrate, power, and efficiency', () => {
    const r = computeMining(baseInputs);
    expect(r.totalHashrateTh).toBe(100);
    expect(r.totalPowerKw).toBe(3);
    expect(r.fleetEfficiencyJPerTh).toBeCloseTo(30, 6);
  });

  it('computes a 40% margin for the base scenario', () => {
    const r = computeMining(baseInputs);
    expect(r.miningMarginPct).toBeCloseTo(0.4, 6);
  });

  it('computes breakeven price as power cost per BTC mined', () => {
    const r = computeMining(baseInputs);
    expect(r.breakevenBtcPrice).toBeCloseTo(36_000, 3);
  });

  it('keeps breakeven independent of uptime', () => {
    const full = computeMining(baseInputs);
    const half = computeMining({ ...baseInputs, uptimePct: 0.5 });
    expect(half.breakevenBtcPrice).toBeCloseTo(full.breakevenBtcPrice, 3);
  });

  it('raises breakeven when the pool fee rises', () => {
    const withFee = computeMining({ ...baseInputs, poolFeePct: 0.5 });
    expect(withFee.breakevenBtcPrice).toBeCloseTo(72_000, 3);
  });

  it('reports carbon only when a carbon intensity is provided', () => {
    expect(computeMining(baseInputs).monthlyCo2Tonnes).toBe(0);
    expect(
      computeMining({ ...baseInputs, carbonKgPerKwh: 0.5 }).monthlyCo2Tonnes,
    ).toBeGreaterThan(0);
  });

  it('returns zero production for zero quantity', () => {
    const r = computeMining({ ...baseInputs, minerCount: 0 });
    expect(r.btcMinedPerMonth).toBe(0);
    expect(r.monthlyRevenue).toBe(0);
    expect(r.monthlyPowerCost).toBe(0);
  });

  it('handles zero power price', () => {
    const r = computeMining({ ...baseInputs, electricityRatePerKwh: 0 });
    expect(r.monthlyPowerCost).toBe(0);
    expect(r.monthlyGrossProfit).toBeCloseTo(r.monthlyRevenue, 6);
    expect(r.breakevenBtcPrice).toBe(0);
  });

  it('reports negative profit at high power prices', () => {
    const r = computeMining({ ...baseInputs, electricityRatePerKwh: 0.5 });
    expect(r.monthlyGrossProfit).toBeLessThan(0);
    expect(r.miningMarginPct).toBeLessThan(0);
  });
});

describe('pure cost / production helpers', () => {
  it('computes miner power and hosting costs', () => {
    const power = minerPowerCostUsdPerMonth({
      quantity: 2,
      powerWatts: 3000,
      electricityRateUsdPerKwh: 0.05,
      uptimePct: 1,
    });
    expect(power).toBeGreaterThan(0);
    expect(
      minerHostingCostUsdPerMonth({ quantity: 0, hostingFeeUsdPerMonth: 100 }),
    ).toBe(0);
    expect(
      minerHostingCostUsdPerMonth({ quantity: 2, hostingFeeUsdPerMonth: 100 }),
    ).toBe(100);
  });

  it('returns zero BTC production for zero quantity', () => {
    expect(
      minerMonthlyBtcProduction({
        quantity: 0,
        hashrateTh: 200,
        btcPerThPerDay: 1e-6,
        poolFeePct: 0,
        uptimePct: 1,
      }),
    ).toBe(0);
  });

  it('returns null cost-to-mine when production is zero', () => {
    expect(costToMineOneBtcUsd(1000, 0)).toBeNull();
    expect(costToMineOneBtcUsd(1000, 2)).toBeCloseTo(500, 6);
  });

  it('computes hardware and BTC-denominated ROI', () => {
    expect(simpleHardwareRoiAnnual(100, 1200)).toBeCloseTo(1, 6);
    expect(simpleHardwareRoiAnnual(100, 0)).toBeNull();
    expect(btcDenominatedRoiAnnual(0.1, 6400, 64_000)).toBeCloseTo(12, 6);
    expect(btcDenominatedRoiAnnual(0.1, 0, 64_000)).toBeNull();
  });

  it('computes revenue from BTC × price', () => {
    expect(minerRevenueUsdPerMonth(1, 64_000)).toBe(64_000);
  });
});

describe('ledger fleet projection', () => {
  const ctx = {
    btcPriceUsd: 60_000,
    btcPerThPerDay: 1e-6,
    poolFeePct: 0,
    uptimePct: 1,
  };

  const online: LedgerMinerInput = {
    id: 'a',
    model: 'A',
    quantity: 10,
    hashrateTh: 100,
    powerWatts: 3000,
    electricityRateUsdPerKwh: 0.05,
    hostingFeeUsdPerMonth: 0,
    contributesToProduction: true,
    purchasePriceUsd: 4000,
  };

  it('excludes offline / ordered / decommissioned from production', () => {
    const offline = projectMinerLine(
      { ...online, id: 'b', contributesToProduction: false, quantity: 5 },
      ctx,
    );
    const ordered = projectMinerLine(
      { ...online, id: 'c', contributesToProduction: false, quantity: 2 },
      ctx,
    );
    const active = projectMinerLine(online, ctx);
    const summary = aggregateFleetProjection([active, offline, ordered]);

    expect(summary.totalMachines).toBe(17);
    expect(summary.onlineMachines).toBe(10);
    expect(summary.fleetHashrateTh).toBe(1000);
    expect(offline.btcPerMonth).toBe(0);
    expect(ordered.revenueUsdPerMonth).toBe(0);
  });

  it('handles zero quantity active rows', () => {
    const line = projectMinerLine({ ...online, quantity: 0 }, ctx);
    expect(line.active).toBe(false);
    expect(line.btcPerMonth).toBe(0);
  });

  it('aggregates mixed fleet models with weighted efficiency', () => {
    const a = projectMinerLine(online, ctx);
    const b = projectMinerLine(
      {
        ...online,
        id: 'b',
        quantity: 5,
        hashrateTh: 200,
        powerWatts: 3500,
      },
      ctx,
    );
    const summary = aggregateFleetProjection([a, b]);
    expect(summary.fleetHashrateTh).toBe(10 * 100 + 5 * 200);
    expect(summary.weightedEfficiencyJTh).toBeCloseTo(
      (10 * 3000 + 5 * 3500) / summary.fleetHashrateTh,
      6,
    );
    expect(summary.estimatedMiningEbitdaUsdPerMonth).toBeCloseTo(
      summary.estimatedRevenueUsdPerMonth -
        summary.estimatedOperatingCostUsdPerMonth,
      6,
    );
  });

  it('reports negative EBITDA at high power price', () => {
    const line = projectMinerLine(
      { ...online, electricityRateUsdPerKwh: 0.5 },
      ctx,
    );
    expect(line.profitUsdPerMonth).toBeLessThan(0);
    const summary = aggregateFleetProjection([line]);
    expect(summary.estimatedMiningEbitdaUsdPerMonth).toBeLessThan(0);
  });
});

describe('summarizeFleet', () => {
  const ctx: FleetContext = {
    btcPriceUsd: 60_000,
    btcPerThPerDay: 1e-6,
    poolFeePct: 0,
    uptimePct: 1,
    electricityRatePerKwh: 0.05,
  };

  const fleet: MinerModel[] = [
    {
      id: 'a',
      model: 'A',
      quantity: 10,
      hashrateTh: 100,
      watts: 3000,
      status: 'online',
    },
    {
      id: 'b',
      model: 'B',
      quantity: 5,
      hashrateTh: 100,
      watts: 3000,
      status: 'provisioning',
    },
    {
      id: 'c',
      model: 'C',
      quantity: 3,
      hashrateTh: 100,
      watts: 3000,
      status: 'offline',
    },
  ];

  it('counts total vs active miners', () => {
    const s = summarizeFleet(fleet, ctx);
    expect(s.totalMiners).toBe(18);
    expect(s.activeMiners).toBe(10);
  });

  it('aggregates only online miners into live hashrate and power', () => {
    const s = summarizeFleet(fleet, ctx);
    expect(s.activeHashrateTh).toBe(1000);
    expect(s.activePowerKw).toBe(30);
    expect(s.avgEfficiencyJPerTh).toBeCloseTo(30, 6);
  });

  it('derives cash flow and breakeven from the active fleet', () => {
    const s = summarizeFleet(fleet, ctx);
    expect(s.monthlyCashFlow).toBeCloseTo(
      s.monthlyRevenue - s.monthlyOperatingCost,
      6,
    );
    expect(s.breakevenBtcPrice).toBeCloseTo(36_000, 3);
  });

  it('excludes zero-quantity online miners from production', () => {
    const s = summarizeFleet(
      [{ ...fleet[0], quantity: 0 }, fleet[1]],
      ctx,
    );
    expect(s.activeMiners).toBe(0);
    expect(s.btcMinedPerMonth).toBe(0);
  });
});
