/**
 * Per-miner / per-model unit economics.
 *
 * Uses the pure mining engine. Purchase cost is used only for cash-on-cash
 * return and payback — never added to operating expense.
 */

import { DAYS_PER_MONTH } from './estimator';
import {
  computeMining,
  type MiningInputs,
  type MiningResult,
} from './mining';
import { derived, DataSource, type SourcedValue } from '../domain/dataSource';
import type { DataSource as DataSourceT } from '../domain/dataSource';

export interface UnitEconomicsInputs {
  quantity: number;
  hashrateTh: number;
  watts: number;
  electricityRatePerKwh: number;
  hostingFeeUsdPerMonth: number;
  btcPriceUsd: number;
  btcPerThPerDay: number;
  poolFeePct: number;
  uptimePct: number;
  /** Hardware + shipping + deploy. Not an opex input. */
  deployedCapitalUsd: number | null;
}

export interface UnitEconomics {
  expectedBtcPerDay: number;
  expectedBtcPerMonth: number;
  usdRevenuePerDay: number;
  usdRevenuePerMonth: number;
  electricityPerDay: number;
  electricityPerMonth: number;
  hostingPerDay: number;
  hostingPerMonth: number;
  totalOperatingCostPerDay: number;
  totalOperatingCostPerMonth: number;
  grossMiningProfitPerDay: number;
  grossMiningProfitPerMonth: number;
  miningMarginPct: number;
  revenuePerThUsd: number | null;
  costPerThUsd: number | null;
  breakevenBtcPrice: number;
  breakevenElectricityRate: number | null;
  annualizedCashOnCashReturn: number | null;
  estimatedHardwarePaybackMonths: number | null;
  modeled: MiningResult;
}

export function breakevenElectricityRateUsdPerKwh(args: {
  quantity: number;
  watts: number;
  hashrateTh: number;
  btcPriceUsd: number;
  btcPerThPerDay: number;
  poolFeePct: number;
  uptimePct: number;
  hostingFeeUsdPerMonth: number;
}): number | null {
  const qty = args.quantity;
  if (qty <= 0 || args.watts <= 0) return null;
  const kwhPerMonth =
    (qty * args.watts * 24 * args.uptimePct * DAYS_PER_MONTH) / 1000;
  if (kwhPerMonth <= 0) return null;
  const btcPerMonth =
    qty *
    args.hashrateTh *
    args.btcPerThPerDay *
    args.uptimePct *
    (1 - args.poolFeePct) *
    DAYS_PER_MONTH;
  const revenue = btcPerMonth * args.btcPriceUsd;
  const hosting = qty > 0 ? Math.max(0, args.hostingFeeUsdPerMonth) : 0;
  return (revenue - hosting) / kwhPerMonth;
}

export function computeUnitEconomics(inputs: UnitEconomicsInputs): UnitEconomics {
  const miningInputs: MiningInputs = {
    minerCount: inputs.quantity,
    hashratePerMinerTh: inputs.hashrateTh,
    wattsPerMiner: inputs.watts,
    electricityRatePerKwh: inputs.electricityRatePerKwh,
    btcPriceUsd: inputs.btcPriceUsd,
    btcPerThPerDay: inputs.btcPerThPerDay,
    poolFeePct: inputs.poolFeePct,
    uptimePct: inputs.uptimePct,
    hostingFeeUsdPerMonth: inputs.hostingFeeUsdPerMonth,
  };
  const modeled = computeMining(miningInputs);
  const expectedBtcPerMonth = modeled.btcMinedPerMonth;
  const expectedBtcPerDay = expectedBtcPerMonth / DAYS_PER_MONTH;
  const usdRevenuePerMonth = modeled.monthlyRevenue;
  const usdRevenuePerDay = usdRevenuePerMonth / DAYS_PER_MONTH;
  const electricityPerMonth = modeled.monthlyPowerCost;
  const electricityPerDay = electricityPerMonth / DAYS_PER_MONTH;
  const hostingPerMonth = modeled.monthlyHostingCost;
  const hostingPerDay = hostingPerMonth / DAYS_PER_MONTH;
  const totalOperatingCostPerMonth = modeled.monthlyOperatingCost;
  const totalOperatingCostPerDay = totalOperatingCostPerMonth / DAYS_PER_MONTH;
  const grossMiningProfitPerMonth = modeled.monthlyGrossProfit;
  const grossMiningProfitPerDay = grossMiningProfitPerMonth / DAYS_PER_MONTH;
  const totalTh = inputs.quantity * inputs.hashrateTh;

  const annualizedCashOnCashReturn =
    inputs.deployedCapitalUsd != null && inputs.deployedCapitalUsd > 0
      ? (grossMiningProfitPerMonth * 12) / inputs.deployedCapitalUsd
      : null;
  const estimatedHardwarePaybackMonths =
    inputs.deployedCapitalUsd != null &&
    inputs.deployedCapitalUsd > 0 &&
    grossMiningProfitPerMonth > 0
      ? inputs.deployedCapitalUsd / grossMiningProfitPerMonth
      : null;

  return {
    expectedBtcPerDay,
    expectedBtcPerMonth,
    usdRevenuePerDay,
    usdRevenuePerMonth,
    electricityPerDay,
    electricityPerMonth,
    hostingPerDay,
    hostingPerMonth,
    totalOperatingCostPerDay,
    totalOperatingCostPerMonth,
    grossMiningProfitPerDay,
    grossMiningProfitPerMonth,
    miningMarginPct: modeled.miningMarginPct,
    revenuePerThUsd: totalTh > 0 ? usdRevenuePerDay / totalTh : null,
    costPerThUsd: totalTh > 0 ? totalOperatingCostPerDay / totalTh : null,
    breakevenBtcPrice: modeled.breakevenBtcPrice,
    breakevenElectricityRate: breakevenElectricityRateUsdPerKwh(inputs),
    annualizedCashOnCashReturn,
    estimatedHardwarePaybackMonths,
    modeled,
  };
}

export function unitEconomicsProvenance(args: {
  btcPriceSource: DataSourceT;
  networkSource: DataSourceT;
  hashrateSource: DataSourceT;
  poolFeeSource?: DataSourceT;
}): SourcedValue<null> {
  return derived(null, [
    { label: 'BTC Price', source: args.btcPriceSource },
    { label: 'Network Hashrate', source: args.networkSource },
    { label: 'Miner Hashrate', source: args.hashrateSource },
    { label: 'Pool Fee', source: args.poolFeeSource ?? DataSource.MODELED },
  ]);
}
