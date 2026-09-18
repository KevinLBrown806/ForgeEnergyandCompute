import { describe, expect, it } from 'vitest';
import {
  btcPerThPerDay,
  computeMining,
  summarizeFleet,
  type FleetContext,
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
    { id: 'a', model: 'A', quantity: 10, hashrateTh: 100, watts: 3000, status: 'online' },
    { id: 'b', model: 'B', quantity: 5, hashrateTh: 100, watts: 3000, status: 'provisioning' },
  ];

  it('counts total vs active miners', () => {
    const s = summarizeFleet(fleet, ctx);
    expect(s.totalMiners).toBe(15);
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
});
