/**
 * Forge Energy & Compute — central configuration organized by domain.
 *
 * Domains keep real company records, market assumptions, and modeled
 * scenarios from being confused with each other.
 *
 * Provenance rules (see `src/domain/dataSource.ts`):
 *   MANUAL  — Forge company records entered here or via operator UI
 *   MODELED — calculated projections / assumptions
 *   LIVE    — reserved for API-fed metrics (Braiins, spot price, etc.)
 *
 * Fleet inventory is NOT stored here at runtime — it lives in the Fleet
 * Registry (localStorage). Demo placeholders live in `demoFleet.ts`.
 */

import type { DataSource } from '../domain/dataSource';
import { DataSource as DS } from '../domain/dataSource';

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

/** Future infrastructure tracking domains (modules not built yet). */
export interface InfrastructureRoadmapItem {
  id: string;
  label: string;
  status: 'planned' | 'exploring';
  note: string;
}

export interface CompanyInfo {
  name: string;
  legalName: string;
  /** Short operating name shown in the UI. */
  brand: string;
}

export interface MarketAssumptions {
  /** MODELED until a live spot-price feed is wired. */
  btcPriceUsd: number;
  btcPriceSource: DataSource;
  network: {
    networkHashrateEhs: number;
    blockRewardBtc: number;
    blocksPerDay: number;
  };
  networkSource: DataSource;
  /** Pool fee as a fraction, 0..1. */
  poolFeePct: number;
  /** Fleet uptime as a fraction, 0..1 (scenario default). */
  uptimePct: number;
  /** Grid carbon intensity (kg CO2 / kWh) — secondary metric only. */
  carbonKgPerKwh: number;
}

export interface TreasuryDefaults {
  btcHoldings: number;
  avgAcquisitionPriceUsd: number;
  btcMined: number;
  btcPurchased: number;
  btcSold: number;
  btcTransferred: number;
  btcCostBasisUsd: number | null;
  cashReserveUsd: number;
  minerHardwareBookValueUsd: number;
  otherAssetsUsd: number;
  liabilitiesUsd: number;
  monthlyAccumulationBtc: number;
  targetBtc: number;
  accumulationHistory: AccumulationPoint[];
}

export interface EnergyConfig {
  availableMw: number;
  deployedMw: number;
  avgElectricityRatePerKwh: number;
  sources: EnergySource[];
}

export interface ScenarioAssumptions {
  /** Default miner count for the forecast calculator. */
  defaultMinerCount: number;
  defaultHashratePerMinerTh: number;
  defaultWattsPerMiner: number;
}

/**
 * Canonical Forge data object — every domain is explicit.
 * Prefer importing named domain exports below for convenience.
 */
export const forgeData = {
  company: {
    name: 'Forge Energy & Compute',
    legalName: 'Forge Energy & Compute',
    brand: 'FORGE',
  } satisfies CompanyInfo,

  /**
   * Real company actuals that belong in config today are empty by default.
   * Operator-entered registry / treasury values are MANUAL at runtime.
   * Do not put fictional operating balances here.
   */
  actuals: {
    /** Placeholder hook for Found / accounting actuals (future). */
    accountingConnected: false,
    notes:
      'Replace empty treasury / fleet registry values with real Forge records via the operator UI.',
  },

  /**
   * Fleet inventory is runtime-owned (Fleet Registry).
   * See `src/config/demoFleet.ts` for clearly labeled placeholders.
   */
  fleet: {
    /** @deprecated Scenario-only; always empty so fictional qty cannot revive. */
    scenarioModels: [] as MinerModel[],
    defaultElectricityRatePerKwh: 0.045,
  },

  /**
   * Default / empty treasury template (MANUAL source when saved).
   * OPERATOR: enter real holdings via the Treasury editor — do not treat
   * these zeros as Forge balances.
   */
  treasury: {
    btcHoldings: 0,
    avgAcquisitionPriceUsd: 0,
    btcMined: 0,
    btcPurchased: 0,
    btcSold: 0,
    btcTransferred: 0,
    btcCostBasisUsd: null,
    cashReserveUsd: 0,
    minerHardwareBookValueUsd: 0,
    otherAssetsUsd: 0,
    liabilitiesUsd: 0,
    monthlyAccumulationBtc: 0,
    targetBtc: 250,
    accumulationHistory: [] as AccumulationPoint[],
  } satisfies TreasuryDefaults,

  energy: {
    availableMw: 30,
    deployedMw: 0,
    avgElectricityRatePerKwh: 0.045,
    sources: [
      { name: 'Grid power', status: 'active', note: 'Primary interconnect' },
      { name: 'Natural gas', status: 'planned', note: 'On-site generation' },
      { name: 'Stranded energy', status: 'exploring', note: 'Remote basins' },
      { name: 'Solar', status: 'planned', note: 'Daytime offset' },
      { name: 'Battery storage', status: 'planned', note: 'Peak shaving' },
      {
        name: 'Flare / behind-the-meter',
        status: 'exploring',
        note: 'Gas capture',
      },
    ],
  } satisfies EnergyConfig,

  /**
   * Market / network assumptions — MODELED until live feeds connect.
   * OPERATOR: update spot price / network hashrate when not using LIVE APIs.
   */
  market: {
    btcPriceUsd: 64_000,
    btcPriceSource: DS.MODELED,
    network: {
      networkHashrateEhs: 700,
      blockRewardBtc: 3.125,
      blocksPerDay: 144,
    },
    networkSource: DS.MODELED,
    poolFeePct: 0.02,
    uptimePct: 0.97,
    carbonKgPerKwh: 0.32,
  } satisfies MarketAssumptions,

  assumptions: {
    defaultMinerCount: 600,
    defaultHashratePerMinerTh: 200,
    defaultWattsPerMiner: 3500,
  } satisfies ScenarioAssumptions,

  scenarios: {
    capitalAllocation: [
      { label: 'Bitcoin', pct: 0.45 },
      { label: 'Mining hardware', pct: 0.3 },
      { label: 'Energy infrastructure', pct: 0.15 },
      { label: 'Cash / dry powder', pct: 0.1 },
    ] satisfies AllocationSlice[],
  },

  roadmap: {
    flywheel: [
      'Energy Assets',
      'Low-Cost Power',
      'Compute / Mining',
      'Bitcoin Production',
      'Bitcoin Treasury',
      'Infrastructure Capacity',
      'Capital Appreciation / Reinvestment',
    ] as string[],
    steps: [
      { title: 'Accumulate Bitcoin', status: 'done' },
      { title: 'Acquire initial miners', status: 'in_progress' },
      { title: 'Validate mining economics', status: 'in_progress' },
      { title: 'Secure low-cost power', status: 'in_progress' },
      { title: 'Scale miner fleet', status: 'planned' },
      { title: 'Acquire or partner on energy assets', status: 'planned' },
      { title: 'Expand into compute infrastructure', status: 'planned' },
      {
        title: 'Track owned infrastructure (sites, power, containers)',
        status: 'planned',
      },
    ] satisfies RoadmapStep[],
    /**
     * Anticipated infrastructure modules — not built yet.
     * Architecture placeholder for hosting capacity, containers, sites,
     * PPAs, behind-the-meter generation, stranded-energy projects, and
     * owned mining facilities.
     */
    infrastructure: [
      {
        id: 'hosting-capacity',
        label: 'Hosting capacity',
        status: 'planned',
        note: 'Contracted MW and rack slots',
      },
      {
        id: 'containers',
        label: 'Containers / pods',
        status: 'planned',
        note: 'Deployable mining containers',
      },
      {
        id: 'sites',
        label: 'Sites',
        status: 'exploring',
        note: 'Owned or partnered locations',
      },
      {
        id: 'power-agreements',
        label: 'Power agreements',
        status: 'planned',
        note: 'PPAs and interconnect contracts',
      },
      {
        id: 'btm-generation',
        label: 'Behind-the-meter generation',
        status: 'exploring',
        note: 'On-site generation assets',
      },
      {
        id: 'stranded-energy',
        label: 'Stranded-energy projects',
        status: 'exploring',
        note: 'Flare / stranded gas opportunities',
      },
      {
        id: 'owned-facilities',
        label: 'Owned mining facilities',
        status: 'planned',
        note: 'Forge-operated sites',
      },
    ] satisfies InfrastructureRoadmapItem[],
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Convenience named exports (preserve existing import paths)                 */
/* -------------------------------------------------------------------------- */

export const market = forgeData.market;
export const treasuryDefaults = forgeData.treasury;
export const energy = forgeData.energy;
export const capitalAllocation = forgeData.scenarios.capitalAllocation;
export const flywheel = forgeData.roadmap.flywheel;
export const roadmap = forgeData.roadmap.steps;
export const infrastructureRoadmap = forgeData.roadmap.infrastructure;

/**
 * @deprecated Removed from operating data. Kept empty so any leftover imports
 * do not revive fictional 600/300/200 fleet quantities.
 */
export const fleet: MinerModel[] = forgeData.fleet.scenarioModels;

/** @deprecated Use treasuryDefaults + TreasuryRepository instead. */
export const treasury = treasuryDefaults;
