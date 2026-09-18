/**
 * Forge Energy & Compute — configuration & market assumptions.
 *
 * Fleet inventory is no longer sourced from this file.
 * Miners live in the Fleet Registry (localStorage repository in v1.1).
 * Demo sample data is available via an explicit Demo Mode toggle.
 *
 * Treasury holdings default to empty / manual — not fictional operating balances.
 */

export type MinerStatus = 'online' | 'provisioning' | 'offline';

/** @deprecated Scenario calculator shape only — not live fleet inventory. */
export interface MinerModel {
  id: string;
  model: string;
  quantity: number;
  /** Per-unit hashrate in TH/s. */
  hashrateTh: number;
  /** Per-unit power draw in watts. */
  watts: number;
  status: MinerStatus;
}

export interface AccumulationPoint {
  /** Short label for the period, e.g. "Jan '25". */
  label: string;
  /** Cumulative BTC held at the end of the period. */
  btc: number;
}

export type AssetStatus = 'active' | 'planned' | 'exploring';

export interface EnergySource {
  name: string;
  status: AssetStatus;
  note: string;
}

export interface AllocationSlice {
  label: string;
  /** Fraction of total capital, 0..1. Slices should sum to 1. */
  pct: number;
}

export type RoadmapStatus = 'done' | 'in_progress' | 'planned';

export interface RoadmapStep {
  title: string;
  status: RoadmapStatus;
}

/** Market and network assumptions that drive the mining economics calculator. */
export const market = {
  btcPriceUsd: 64_000,
  /**
   * Network parameters used to derive the per-TH/s BTC production assumption.
   * `networkHashrateEhs` is the total Bitcoin network hashrate in EH/s.
   */
  network: {
    networkHashrateEhs: 700,
    blockRewardBtc: 3.125,
    blocksPerDay: 144,
  },
  /** Pool fee as a fraction, 0..1. */
  poolFeePct: 0.02,
  /** Fleet uptime as a fraction, 0..1 (scenario default). */
  uptimePct: 0.97,
  /** Grid carbon intensity (kg CO2 / kWh) — secondary metric only. */
  carbonKgPerKwh: 0.32,
} as const;

/**
 * Default / empty treasury template.
 * Operator-entered holdings are stored via TreasuryRepository (manual source).
 * Do not treat these defaults as real Forge balances.
 */
export const treasuryDefaults = {
  btcHoldings: 0,
  avgAcquisitionPriceUsd: 0,
  monthlyAccumulationBtc: 0,
  targetBtc: 250,
  accumulationHistory: [] as AccumulationPoint[],
} as const;

/** Energy / infrastructure position (planning figures). */
export const energy = {
  availableMw: 30,
  deployedMw: 0,
  avgElectricityRatePerKwh: 0.045,
  sources: [
    { name: 'Grid power', status: 'active' as const, note: 'Primary interconnect' },
    { name: 'Natural gas', status: 'planned' as const, note: 'On-site generation' },
    { name: 'Stranded energy', status: 'exploring' as const, note: 'Remote basins' },
    { name: 'Solar', status: 'planned' as const, note: 'Daytime offset' },
    { name: 'Battery storage', status: 'planned' as const, note: 'Peak shaving' },
    { name: 'Flare / behind-the-meter', status: 'exploring' as const, note: 'Gas capture' },
  ] satisfies EnergySource[],
} as const;

/** Capital allocation. Percentages should sum to 1. */
export const capitalAllocation: AllocationSlice[] = [
  { label: 'Bitcoin', pct: 0.45 },
  { label: 'Mining hardware', pct: 0.3 },
  { label: 'Energy infrastructure', pct: 0.15 },
  { label: 'Cash / dry powder', pct: 0.1 },
];

/** The Forge flywheel, top to bottom. */
export const flywheel: string[] = [
  'Energy Assets',
  'Low-Cost Power',
  'Compute / Mining',
  'Bitcoin Production',
  'Bitcoin Treasury',
  'Capital Appreciation / Reinvestment',
];

/** Execution roadmap. */
export const roadmap: RoadmapStep[] = [
  { title: 'Accumulate Bitcoin', status: 'done' },
  { title: 'Acquire initial miners', status: 'in_progress' },
  { title: 'Validate mining economics', status: 'in_progress' },
  { title: 'Secure low-cost power', status: 'in_progress' },
  { title: 'Scale miner fleet', status: 'planned' },
  { title: 'Acquire or partner on energy assets', status: 'planned' },
  { title: 'Expand into compute infrastructure', status: 'planned' },
];

/**
 * @deprecated Removed from operating data. Kept empty so any leftover imports
 * do not revive fictional 600/300/200 fleet quantities.
 */
export const fleet: MinerModel[] = [];

/** @deprecated Use treasuryDefaults + TreasuryRepository instead. */
export const treasury = treasuryDefaults;
