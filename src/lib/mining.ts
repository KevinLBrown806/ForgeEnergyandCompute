/**
 * Pure mining economics engine.
 *
 * All functions accept explicit inputs — they never read config directly.
 * Units are encoded in names/types to prevent TH/s ↔ PH/s and W ↔ kW mistakes.
 *
 * Live Braiins-backed row economics live in `src/domain/fleet.ts`.
 * This module powers the forecast calculator and ledger-style projections.
 */

import { DAYS_PER_MONTH, estimate } from './estimator';
import type { MinerModel } from '../config/forge.config';

export interface NetworkParams {
  /** Total Bitcoin network hashrate in EH/s. */
  networkHashrateEhs: number;
  blockRewardBtc: number;
  blocksPerDay: number;
}

/**
 * Derive BTC earned per TH/s per day at 100% uptime, before pool fees.
 */
export function btcPerThPerDay(network: NetworkParams): number {
  const networkHashrateTh = network.networkHashrateEhs * 1_000_000;
  if (networkHashrateTh <= 0) return 0;
  return (network.blockRewardBtc * network.blocksPerDay) / networkHashrateTh;
}

/* -------------------------------------------------------------------------- */
/* Unit helpers                                                               */
/* -------------------------------------------------------------------------- */

export function thToPh(thPerS: number): number {
  return thPerS / 1_000;
}

export function phToTh(phPerS: number): number {
  return phPerS * 1_000;
}

export function wattsToKw(watts: number): number {
  return watts / 1_000;
}

export function kwToWatts(kw: number): number {
  return kw * 1_000;
}

export function btcToSats(btc: number): number {
  return btc * 100_000_000;
}

export function satsToBtc(sats: number): number {
  return sats / 100_000_000;
}

/* -------------------------------------------------------------------------- */
/* Core power / hosting costs                                                 */
/* -------------------------------------------------------------------------- */

export interface MinerPowerCostInputs {
  quantity: number;
  /** Per-unit power draw in watts. */
  powerWatts: number;
  /** Electricity rate in USD per kWh. */
  electricityRateUsdPerKwh: number;
  /** Uptime as a fraction 0..1. */
  uptimePct: number;
}

/** Monthly electricity cost in USD for a miner line. */
export function minerPowerCostUsdPerMonth(inputs: MinerPowerCostInputs): number {
  if (inputs.quantity <= 0 || inputs.powerWatts <= 0) return 0;
  const energy = estimate({
    deviceCount: inputs.quantity,
    wattsPerDevice: inputs.powerWatts,
    hoursPerDay: 24 * inputs.uptimePct,
    pricePerKwh: inputs.electricityRateUsdPerKwh,
    pue: 1.0,
    carbonKgPerKwh: 0,
  });
  return energy.monthlyCost;
}

export interface MinerHostingCostInputs {
  quantity: number;
  /** Optional hosting fee in USD per month for the line (or per unit × qty). */
  hostingFeeUsdPerMonth: number;
}

/** Monthly hosting cost in USD. Zero quantity → 0. */
export function minerHostingCostUsdPerMonth(
  inputs: MinerHostingCostInputs,
): number {
  if (inputs.quantity <= 0) return 0;
  return Math.max(0, inputs.hostingFeeUsdPerMonth);
}

/* -------------------------------------------------------------------------- */
/* Production / revenue / profit                                              */
/* -------------------------------------------------------------------------- */

export interface MinerProductionInputs {
  quantity: number;
  /** Per-unit hashrate in TH/s. */
  hashrateTh: number;
  /** BTC per TH/s per day at 100% uptime, before pool fee. */
  btcPerThPerDay: number;
  poolFeePct: number;
  uptimePct: number;
}

/** Monthly BTC production for a miner line. */
export function minerMonthlyBtcProduction(
  inputs: MinerProductionInputs,
): number {
  if (inputs.quantity <= 0 || inputs.hashrateTh <= 0) return 0;
  const totalHashrateTh = inputs.quantity * inputs.hashrateTh;
  return (
    totalHashrateTh *
    inputs.btcPerThPerDay *
    inputs.uptimePct *
    (1 - inputs.poolFeePct) *
    DAYS_PER_MONTH
  );
}

export function minerRevenueUsdPerMonth(
  btcPerMonth: number,
  btcPriceUsd: number,
): number {
  return btcPerMonth * btcPriceUsd;
}

export function minerOperatingProfitUsdPerMonth(
  revenueUsd: number,
  powerCostUsd: number,
  hostingCostUsd: number,
): number {
  return revenueUsd - powerCostUsd - hostingCostUsd;
}

/* -------------------------------------------------------------------------- */
/* Fleet aggregation                                                          */
/* -------------------------------------------------------------------------- */

/** Ledger-style miner row used by the pure projection engine. */
export interface LedgerMinerInput {
  id: string;
  model: string;
  quantity: number;
  hashrateTh: number;
  powerWatts: number;
  electricityRateUsdPerKwh: number;
  hostingFeeUsdPerMonth: number;
  /**
   * When false, excluded from active production (offline / repair /
   * ordered / decommissioned).
   */
  contributesToProduction: boolean;
  purchasePriceUsd: number | null;
}

export interface FleetProjectionContext {
  btcPriceUsd: number;
  btcPerThPerDay: number;
  poolFeePct: number;
  uptimePct: number;
}

export interface LedgerMinerProjection {
  miner: LedgerMinerInput;
  active: boolean;
  totalHashrateTh: number;
  totalPowerKw: number;
  efficiencyJPerTh: number;
  btcPerMonth: number;
  revenueUsdPerMonth: number;
  powerCostUsdPerMonth: number;
  hostingCostUsdPerMonth: number;
  operatingCostUsdPerMonth: number;
  profitUsdPerMonth: number;
  /** Simple hardware ROI: annual profit / purchase cost, or null. */
  hardwareRoiAnnual: number | null;
  /** BTC earned per year / BTC-equivalent purchase cost, or null. */
  btcDenominatedRoiAnnual: number | null;
}

export interface FleetProjectionSummary {
  totalMachines: number;
  onlineMachines: number;
  /** Active fleet hashrate in TH/s. */
  fleetHashrateTh: number;
  /** Active fleet hashrate in PH/s. */
  fleetHashratePh: number;
  /** Active fleet power draw in kW. */
  fleetPowerKw: number;
  /** Weighted average efficiency of active machines, J/TH. */
  weightedEfficiencyJTh: number;
  estimatedBtcPerDay: number;
  estimatedBtcPerMonth: number;
  estimatedRevenueUsdPerMonth: number;
  estimatedOperatingCostUsdPerMonth: number;
  estimatedMiningEbitdaUsdPerMonth: number;
  electricityCostUsdPerMonth: number;
  hostingCostUsdPerMonth: number;
  costToMineOneBtcUsd: number | null;
  satsPerDay: number;
}

export function projectMinerLine(
  miner: LedgerMinerInput,
  ctx: FleetProjectionContext,
): LedgerMinerProjection {
  const active = miner.contributesToProduction && miner.quantity > 0;
  const qty = active ? miner.quantity : 0;

  const totalHashrateTh = qty * miner.hashrateTh;
  const totalWatts = qty * miner.powerWatts;
  const totalPowerKw = wattsToKw(totalWatts);
  const efficiencyJPerTh =
    totalHashrateTh > 0 ? totalWatts / totalHashrateTh : 0;

  const powerCostUsdPerMonth = minerPowerCostUsdPerMonth({
    quantity: qty,
    powerWatts: miner.powerWatts,
    electricityRateUsdPerKwh: miner.electricityRateUsdPerKwh,
    uptimePct: ctx.uptimePct,
  });
  const hostingCostUsdPerMonth = minerHostingCostUsdPerMonth({
    quantity: qty,
    hostingFeeUsdPerMonth: miner.hostingFeeUsdPerMonth,
  });
  const btcPerMonth = minerMonthlyBtcProduction({
    quantity: qty,
    hashrateTh: miner.hashrateTh,
    btcPerThPerDay: ctx.btcPerThPerDay,
    poolFeePct: ctx.poolFeePct,
    uptimePct: ctx.uptimePct,
  });
  const revenueUsdPerMonth = minerRevenueUsdPerMonth(
    btcPerMonth,
    ctx.btcPriceUsd,
  );
  const operatingCostUsdPerMonth =
    powerCostUsdPerMonth + hostingCostUsdPerMonth;
  const profitUsdPerMonth = minerOperatingProfitUsdPerMonth(
    revenueUsdPerMonth,
    powerCostUsdPerMonth,
    hostingCostUsdPerMonth,
  );

  const purchaseTotal =
    miner.purchasePriceUsd != null && miner.purchasePriceUsd > 0
      ? miner.purchasePriceUsd * Math.max(miner.quantity, 0)
      : null;

  const hardwareRoiAnnual =
    purchaseTotal != null && purchaseTotal > 0
      ? (profitUsdPerMonth * 12) / purchaseTotal
      : null;

  const btcDenominatedRoiAnnual =
    purchaseTotal != null &&
    purchaseTotal > 0 &&
    ctx.btcPriceUsd > 0 &&
    btcPerMonth > 0
      ? (btcPerMonth * 12) / (purchaseTotal / ctx.btcPriceUsd)
      : null;

  return {
    miner,
    active,
    totalHashrateTh,
    totalPowerKw,
    efficiencyJPerTh,
    btcPerMonth,
    revenueUsdPerMonth,
    powerCostUsdPerMonth,
    hostingCostUsdPerMonth,
    operatingCostUsdPerMonth,
    profitUsdPerMonth,
    hardwareRoiAnnual,
    btcDenominatedRoiAnnual,
  };
}

export function aggregateFleetProjection(
  lines: LedgerMinerProjection[],
): FleetProjectionSummary {
  const active = lines.filter((l) => l.active);
  const totalMachines = lines.reduce((s, l) => s + l.miner.quantity, 0);
  const onlineMachines = active.reduce((s, l) => s + l.miner.quantity, 0);
  const fleetHashrateTh = active.reduce((s, l) => s + l.totalHashrateTh, 0);
  const fleetWatts = active.reduce(
    (s, l) => s + l.miner.quantity * l.miner.powerWatts,
    0,
  );
  const fleetPowerKw = wattsToKw(fleetWatts);
  const weightedEfficiencyJTh =
    fleetHashrateTh > 0 ? fleetWatts / fleetHashrateTh : 0;

  const estimatedBtcPerMonth = active.reduce((s, l) => s + l.btcPerMonth, 0);
  const estimatedRevenueUsdPerMonth = active.reduce(
    (s, l) => s + l.revenueUsdPerMonth,
    0,
  );
  const electricityCostUsdPerMonth = active.reduce(
    (s, l) => s + l.powerCostUsdPerMonth,
    0,
  );
  const hostingCostUsdPerMonth = active.reduce(
    (s, l) => s + l.hostingCostUsdPerMonth,
    0,
  );
  const estimatedOperatingCostUsdPerMonth =
    electricityCostUsdPerMonth + hostingCostUsdPerMonth;
  const estimatedMiningEbitdaUsdPerMonth =
    estimatedRevenueUsdPerMonth - estimatedOperatingCostUsdPerMonth;
  const estimatedBtcPerDay = estimatedBtcPerMonth / DAYS_PER_MONTH;

  return {
    totalMachines,
    onlineMachines,
    fleetHashrateTh,
    fleetHashratePh: thToPh(fleetHashrateTh),
    fleetPowerKw,
    weightedEfficiencyJTh,
    estimatedBtcPerDay,
    estimatedBtcPerMonth,
    estimatedRevenueUsdPerMonth,
    estimatedOperatingCostUsdPerMonth,
    estimatedMiningEbitdaUsdPerMonth,
    electricityCostUsdPerMonth,
    hostingCostUsdPerMonth,
    costToMineOneBtcUsd: costToMineOneBtcUsd(
      estimatedOperatingCostUsdPerMonth,
      estimatedBtcPerMonth,
    ),
    satsPerDay: btcToSats(estimatedBtcPerDay),
  };
}

/** Operating cost (USD) required to produce one BTC. */
export function costToMineOneBtcUsd(
  operatingCostUsdPerMonth: number,
  btcMinedPerMonth: number,
): number | null {
  if (btcMinedPerMonth <= 0) return null;
  return operatingCostUsdPerMonth / btcMinedPerMonth;
}

/** Simple hardware ROI: annual operating profit / purchase cost. */
export function simpleHardwareRoiAnnual(
  profitUsdPerMonth: number,
  purchaseCostUsd: number,
): number | null {
  if (purchaseCostUsd <= 0) return null;
  return (profitUsdPerMonth * 12) / purchaseCostUsd;
}

/**
 * BTC-denominated ROI: annual BTC produced / BTC-equivalent purchase cost
 * at the given spot price.
 */
export function btcDenominatedRoiAnnual(
  btcPerMonth: number,
  purchaseCostUsd: number,
  btcPriceUsd: number,
): number | null {
  if (purchaseCostUsd <= 0 || btcPriceUsd <= 0) return null;
  const purchaseBtc = purchaseCostUsd / btcPriceUsd;
  if (purchaseBtc <= 0) return null;
  return (btcPerMonth * 12) / purchaseBtc;
}

/* -------------------------------------------------------------------------- */
/* Forecast calculator (existing API)                                         */
/* -------------------------------------------------------------------------- */

export interface MiningInputs {
  minerCount: number;
  /** Per-miner hashrate in TH/s. */
  hashratePerMinerTh: number;
  /** Per-miner power draw in watts. */
  wattsPerMiner: number;
  /** Electricity rate in USD per kWh. */
  electricityRatePerKwh: number;
  btcPriceUsd: number;
  /** BTC per TH/s per day at 100% uptime, before pool fee. */
  btcPerThPerDay: number;
  /** Pool fee as a fraction, 0..1. */
  poolFeePct: number;
  /** Uptime as a fraction, 0..1. */
  uptimePct: number;
  /** Grid carbon intensity (kg CO2 / kWh) — optional secondary metric. */
  carbonKgPerKwh?: number;
  /** Optional hosting fee USD / month for the whole line. */
  hostingFeeUsdPerMonth?: number;
}

export interface MiningResult {
  totalHashrateTh: number;
  totalPowerKw: number;
  fleetEfficiencyJPerTh: number;
  monthlyKwh: number;
  monthlyPowerCost: number;
  monthlyHostingCost: number;
  monthlyOperatingCost: number;
  btcMinedPerMonth: number;
  monthlyRevenue: number;
  monthlyGrossProfit: number;
  miningMarginPct: number;
  breakevenBtcPrice: number;
  costToMineOneBtcUsd: number | null;
  /** Secondary metric: monthly CO2 in metric tonnes (0 if no carbon input). */
  monthlyCo2Tonnes: number;
}

/**
 * Core Bitcoin mining economics. Uptime scales both energy and production, so
 * it cancels in margin and breakeven — matching real-world intuition.
 */
export function computeMining(inputs: MiningInputs): MiningResult {
  const {
    minerCount,
    hashratePerMinerTh,
    wattsPerMiner,
    electricityRatePerKwh,
    btcPriceUsd,
    btcPerThPerDay: production,
    poolFeePct,
    uptimePct,
    carbonKgPerKwh = 0,
    hostingFeeUsdPerMonth = 0,
  } = inputs;

  const totalHashrateTh = minerCount * hashratePerMinerTh;
  const totalWatts = minerCount * wattsPerMiner;
  const totalPowerKw = wattsToKw(totalWatts);
  const fleetEfficiencyJPerTh =
    totalHashrateTh > 0 ? totalWatts / totalHashrateTh : 0;

  const runHoursPerDay = 24 * uptimePct;

  const energy = estimate({
    deviceCount: minerCount,
    wattsPerDevice: wattsPerMiner,
    hoursPerDay: runHoursPerDay,
    pricePerKwh: electricityRatePerKwh,
    pue: 1.0,
    carbonKgPerKwh,
  });

  const monthlyKwh = energy.monthlyKwh;
  const monthlyPowerCost = energy.monthlyCost;
  const monthlyHostingCost =
    minerCount > 0 ? Math.max(0, hostingFeeUsdPerMonth) : 0;
  const monthlyOperatingCost = monthlyPowerCost + monthlyHostingCost;
  const monthlyCo2Tonnes = energy.monthlyCo2Tonnes;

  const btcMinedPerMonth =
    totalHashrateTh *
    production *
    uptimePct *
    (1 - poolFeePct) *
    DAYS_PER_MONTH;

  const monthlyRevenue = btcMinedPerMonth * btcPriceUsd;
  const monthlyGrossProfit = monthlyRevenue - monthlyOperatingCost;
  const miningMarginPct =
    monthlyRevenue > 0 ? monthlyGrossProfit / monthlyRevenue : 0;
  const breakevenBtcPrice =
    btcMinedPerMonth > 0 ? monthlyOperatingCost / btcMinedPerMonth : 0;

  return {
    totalHashrateTh,
    totalPowerKw,
    fleetEfficiencyJPerTh,
    monthlyKwh,
    monthlyPowerCost,
    monthlyHostingCost,
    monthlyOperatingCost,
    btcMinedPerMonth,
    monthlyRevenue,
    monthlyGrossProfit,
    miningMarginPct,
    breakevenBtcPrice,
    costToMineOneBtcUsd: costToMineOneBtcUsd(
      monthlyOperatingCost,
      btcMinedPerMonth,
    ),
    monthlyCo2Tonnes,
  };
}

/* -------------------------------------------------------------------------- */
/* Legacy MinerModel helpers (scenario calculator / tests)                    */
/* -------------------------------------------------------------------------- */

export interface MinerEconomics {
  miner: MinerModel;
  /** Whether this line contributes to live production (status === online). */
  active: boolean;
  totalHashrateTh: number;
  totalPowerKw: number;
  efficiencyJPerTh: number;
  electricityCostPerDay: number;
  btcPerMonth: number;
  monthlyRevenue: number;
  operatingMarginPct: number;
}

export interface FleetContext {
  btcPriceUsd: number;
  btcPerThPerDay: number;
  poolFeePct: number;
  uptimePct: number;
  electricityRatePerKwh: number;
  carbonKgPerKwh?: number;
}

/** Compute per-line economics for a single miner model. */
export function computeMinerEconomics(
  miner: MinerModel,
  ctx: FleetContext,
): MinerEconomics {
  const active = miner.status === 'online' && miner.quantity > 0;
  const result = computeMining({
    minerCount: active ? miner.quantity : 0,
    hashratePerMinerTh: miner.hashrateTh,
    wattsPerMiner: miner.watts,
    electricityRatePerKwh: ctx.electricityRatePerKwh,
    btcPriceUsd: ctx.btcPriceUsd,
    btcPerThPerDay: ctx.btcPerThPerDay,
    poolFeePct: ctx.poolFeePct,
    uptimePct: ctx.uptimePct,
    carbonKgPerKwh: ctx.carbonKgPerKwh,
  });

  return {
    miner,
    active,
    totalHashrateTh: result.totalHashrateTh,
    totalPowerKw: result.totalPowerKw,
    efficiencyJPerTh: result.fleetEfficiencyJPerTh,
    electricityCostPerDay: result.monthlyPowerCost / DAYS_PER_MONTH,
    btcPerMonth: result.btcMinedPerMonth,
    monthlyRevenue: result.monthlyRevenue,
    operatingMarginPct: result.miningMarginPct,
  };
}

export interface FleetSummary {
  totalMiners: number;
  activeMiners: number;
  /** Live hashrate from online miners only, in TH/s. */
  activeHashrateTh: number;
  /** Live power draw from online miners only, in kW. */
  activePowerKw: number;
  /** Weighted average efficiency of online miners, in J/TH. */
  avgEfficiencyJPerTh: number;
  btcMinedPerMonth: number;
  monthlyRevenue: number;
  monthlyOperatingCost: number;
  monthlyCashFlow: number;
  breakevenBtcPrice: number;
  monthlyCo2Tonnes: number;
}

/**
 * Aggregate a fleet into headline figures. Only `online` miners contribute to
 * live hashrate, production, revenue, and cost. Ordered / offline / zero-qty
 * lines are excluded from active production.
 */
export function summarizeFleet(
  fleet: MinerModel[],
  ctx: FleetContext,
): FleetSummary {
  const totalMiners = fleet.reduce((sum, m) => sum + m.quantity, 0);

  const online = fleet.filter(
    (m) => m.status === 'online' && m.quantity > 0,
  );
  const activeMiners = online.reduce((sum, m) => sum + m.quantity, 0);
  const activeHashrateTh = online.reduce(
    (sum, m) => sum + m.quantity * m.hashrateTh,
    0,
  );
  const activeWatts = online.reduce((sum, m) => sum + m.quantity * m.watts, 0);
  const activePowerKw = wattsToKw(activeWatts);
  const avgEfficiencyJPerTh =
    activeHashrateTh > 0 ? activeWatts / activeHashrateTh : 0;

  const combined = computeMining({
    minerCount: 1,
    hashratePerMinerTh: activeHashrateTh,
    wattsPerMiner: activeWatts,
    electricityRatePerKwh: ctx.electricityRatePerKwh,
    btcPriceUsd: ctx.btcPriceUsd,
    btcPerThPerDay: ctx.btcPerThPerDay,
    poolFeePct: ctx.poolFeePct,
    uptimePct: ctx.uptimePct,
    carbonKgPerKwh: ctx.carbonKgPerKwh,
  });

  return {
    totalMiners,
    activeMiners,
    activeHashrateTh,
    activePowerKw,
    avgEfficiencyJPerTh,
    btcMinedPerMonth: combined.btcMinedPerMonth,
    monthlyRevenue: combined.monthlyRevenue,
    monthlyOperatingCost: combined.monthlyPowerCost,
    monthlyCashFlow: combined.monthlyGrossProfit,
    breakevenBtcPrice: combined.breakevenBtcPrice,
    monthlyCo2Tonnes: combined.monthlyCo2Tonnes,
  };
}
