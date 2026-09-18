import { DAYS_PER_MONTH, estimate } from './estimator';
import type { MinerModel } from '../config/forge.config';

export interface NetworkParams {
  networkHashrateEhs: number;
  blockRewardBtc: number;
  blocksPerDay: number;
}

/**
 * Derive the "configurable production assumption": BTC earned per TH/s per day
 * at 100% uptime, before pool fees, given the current network parameters.
 */
export function btcPerThPerDay(network: NetworkParams): number {
  const networkHashrateTh = network.networkHashrateEhs * 1_000_000;
  if (networkHashrateTh <= 0) return 0;
  return (network.blockRewardBtc * network.blocksPerDay) / networkHashrateTh;
}

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
}

export interface MiningResult {
  totalHashrateTh: number;
  totalPowerKw: number;
  fleetEfficiencyJPerTh: number;
  monthlyKwh: number;
  monthlyPowerCost: number;
  btcMinedPerMonth: number;
  monthlyRevenue: number;
  monthlyGrossProfit: number;
  miningMarginPct: number;
  breakevenBtcPrice: number;
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
    btcPerThPerDay,
    poolFeePct,
    uptimePct,
    carbonKgPerKwh = 0,
  } = inputs;

  const totalHashrateTh = minerCount * hashratePerMinerTh;
  const totalWatts = minerCount * wattsPerMiner;
  const totalPowerKw = totalWatts / 1000;
  const fleetEfficiencyJPerTh =
    totalHashrateTh > 0 ? totalWatts / totalHashrateTh : 0;

  const runHoursPerDay = 24 * uptimePct;

  // Reuse the energy/carbon estimator (PUE 1.0 — power figures are at the plug).
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
  const monthlyCo2Tonnes = energy.monthlyCo2Tonnes;

  const btcMinedPerMonth =
    totalHashrateTh *
    btcPerThPerDay *
    uptimePct *
    (1 - poolFeePct) *
    DAYS_PER_MONTH;

  const monthlyRevenue = btcMinedPerMonth * btcPriceUsd;
  const monthlyGrossProfit = monthlyRevenue - monthlyPowerCost;
  const miningMarginPct =
    monthlyRevenue > 0 ? monthlyGrossProfit / monthlyRevenue : 0;
  const breakevenBtcPrice =
    btcMinedPerMonth > 0 ? monthlyPowerCost / btcMinedPerMonth : 0;

  return {
    totalHashrateTh,
    totalPowerKw,
    fleetEfficiencyJPerTh,
    monthlyKwh,
    monthlyPowerCost,
    btcMinedPerMonth,
    monthlyRevenue,
    monthlyGrossProfit,
    miningMarginPct,
    breakevenBtcPrice,
    monthlyCo2Tonnes,
  };
}

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
  const active = miner.status === 'online';
  const result = computeMining({
    minerCount: miner.quantity,
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
 * live hashrate, production, revenue, and cost.
 */
export function summarizeFleet(
  fleet: MinerModel[],
  ctx: FleetContext,
): FleetSummary {
  const totalMiners = fleet.reduce((sum, m) => sum + m.quantity, 0);

  const online = fleet.filter((m) => m.status === 'online');
  const activeMiners = online.reduce((sum, m) => sum + m.quantity, 0);
  const activeHashrateTh = online.reduce(
    (sum, m) => sum + m.quantity * m.hashrateTh,
    0,
  );
  const activeWatts = online.reduce((sum, m) => sum + m.quantity * m.watts, 0);
  const activePowerKw = activeWatts / 1000;
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
