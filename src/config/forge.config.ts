/**
 * Forge Energy & Compute — central configuration and mock data.
 *
 * This is the single source of truth for all figures shown on the dashboard.
 * Edit values here to change BTC holdings, miner quantities, electricity
 * prices, capital allocation, etc. UI components never hard-code data — they
 * read it from this file (and derive figures via the pure logic in `src/lib`).
 *
 * When a real backend/API is added later, replace the exported values below
 * with fetched data of the same shape; the calculation modules and UI will not
 * need to change.
 */

export type MinerStatus = 'online' | 'provisioning' | 'offline';

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

/** Market and network assumptions that drive the mining economics. */
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
  /** Fleet uptime as a fraction, 0..1. */
  uptimePct: 0.97,
  /** Grid carbon intensity (kg CO2 / kWh) — secondary metric only. */
  carbonKgPerKwh: 0.32,
} as const;

/** Bitcoin treasury position. */
export const treasury = {
  btcHoldings: 42.5,
  avgAcquisitionPriceUsd: 38_500,
  /** Net BTC added to the treasury each month. */
  monthlyAccumulationBtc: 2.0,
  /** Long-term treasury target in BTC. */
  targetBtc: 250,
  /** Cumulative holdings over time, used by the accumulation chart. */
  accumulationHistory: [
    { label: "Nov '24", btc: 20.0 },
    { label: "Dec '24", btc: 21.75 },
    { label: "Jan '25", btc: 23.5 },
    { label: "Feb '25", btc: 25.0 },
    { label: "Mar '25", btc: 26.75 },
    { label: "Apr '25", btc: 28.5 },
    { label: "May '25", btc: 30.25 },
    { label: "Jun '25", btc: 32.0 },
    { label: "Jul '25", btc: 33.75 },
    { label: "Aug '25", btc: 35.5 },
    { label: "Sep '25", btc: 37.25 },
    { label: "Oct '25", btc: 39.0 },
    { label: "Nov '25", btc: 40.75 },
    { label: "Dec '25", btc: 41.75 },
    { label: "Jan '26", btc: 42.5 },
  ] satisfies AccumulationPoint[],
} as const;

/**
 * Mining fleet. Add or edit miners here — the fleet table and all overview
 * aggregates are derived from this array.
 */
export const fleet: MinerModel[] = [
  {
    id: 's21',
    model: 'Antminer S21',
    quantity: 600,
    hashrateTh: 200,
    watts: 3500,
    status: 'online',
  },
  {
    id: 's21-pro',
    model: 'Antminer S21 Pro',
    quantity: 300,
    hashrateTh: 234,
    watts: 3510,
    status: 'online',
  },
  {
    id: 'm60s',
    model: 'WhatsMiner M60S',
    quantity: 200,
    hashrateTh: 186,
    watts: 3441,
    status: 'provisioning',
  },
];

/** Energy / infrastructure position. */
export const energy = {
  availableMw: 30,
  deployedMw: 6.5,
  avgElectricityRatePerKwh: 0.045,
  /** Future / current energy assets (placeholders for v1). */
  sources: [
    { name: 'Grid power', status: 'active', note: 'Primary interconnect' },
    { name: 'Natural gas', status: 'planned', note: 'On-site generation' },
    { name: 'Stranded energy', status: 'exploring', note: 'Remote basins' },
    { name: 'Solar', status: 'planned', note: 'Daytime offset' },
    { name: 'Battery storage', status: 'planned', note: 'Peak shaving' },
    { name: 'Flare / behind-the-meter', status: 'exploring', note: 'Gas capture' },
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
  { title: 'Acquire initial miners', status: 'done' },
  { title: 'Validate mining economics', status: 'in_progress' },
  { title: 'Secure low-cost power', status: 'in_progress' },
  { title: 'Scale miner fleet', status: 'planned' },
  { title: 'Acquire or partner on energy assets', status: 'planned' },
  { title: 'Expand into compute infrastructure', status: 'planned' },
];
