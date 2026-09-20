import { describe, expect, it } from 'vitest';
import {
  breakevenElectricityRateUsdPerKwh,
  computeUnitEconomics,
} from './unitEconomics';

const inputs = {
  quantity: 1,
  hashrateTh: 100,
  watts: 3000,
  electricityRatePerKwh: 0.05,
  hostingFeeUsdPerMonth: 0,
  btcPriceUsd: 60_000,
  btcPerThPerDay: 1e-6,
  poolFeePct: 0,
  uptimePct: 1,
  deployedCapitalUsd: 4_000,
};

describe('unit economics', () => {
  it('computes production, opex, margin, and cash-on-cash without mixing capex into opex', () => {
    const result = computeUnitEconomics(inputs);
    expect(result.expectedBtcPerMonth).toBeCloseTo(100 * 1e-6 * 30.437, 8);
    expect(result.usdRevenuePerMonth).toBeCloseTo(result.expectedBtcPerMonth * 60_000, 6);
    expect(result.totalOperatingCostPerMonth).toBeCloseTo(result.electricityPerMonth, 6);
    expect(result.miningMarginPct).toBeCloseTo(0.4, 6);
    expect(result.annualizedCashOnCashReturn).toBeCloseTo(
      (result.grossMiningProfitPerMonth * 12) / 4_000,
      6,
    );
    expect(result.estimatedHardwarePaybackMonths).toBeCloseTo(
      4_000 / result.grossMiningProfitPerMonth,
      6,
    );
  });

  it('computes breakeven BTC price as operating cost per BTC', () => {
    const result = computeUnitEconomics(inputs);
    expect(result.breakevenBtcPrice).toBeCloseTo(36_000, 0);
  });

  it('computes breakeven electricity rate independently of purchase cost', () => {
    const rate = breakevenElectricityRateUsdPerKwh(inputs);
    expect(rate).not.toBeNull();
    const atBreakeven = computeUnitEconomics({
      ...inputs,
      electricityRatePerKwh: rate!,
      deployedCapitalUsd: 99_000,
    });
    expect(atBreakeven.grossMiningProfitPerMonth).toBeCloseTo(0, 4);
  });
});
