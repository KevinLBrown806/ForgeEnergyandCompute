/**
 * Owner-level KPI composition.
 * Period slices are only emitted when source data exists.
 */

import type { DataSource } from './dataSource';
import { DataSource as DS, derived, type SourcedValue } from './dataSource';
import type { LedgerPeriod, PeriodLedgerSlice } from '../lib/treasuryLedger';

export interface OwnerKpiSet {
  totalNav: SourcedValue;
  btcTreasuryQty: SourcedValue;
  btcProduced: SourcedValue;
  operatingHashrateTh: SourcedValue;
  miningRevenueUsd: SourcedValue;
  miningOperatingCostUsd: SourcedValue;
  miningOperatingProfitUsd: SourcedValue;
  fleetBookValueUsd: SourcedValue;
  deployedCapitalUsd: SourcedValue;
  returnOnDeployedMiningCapital: SourcedValue<number | null>;
}

export function buildOwnerKpis(args: {
  navUsd: number;
  btcHoldings: number;
  btcProduced: number;
  btcProducedSource: DataSource;
  operatingHashrateTh: number;
  hashrateSource: DataSource;
  miningRevenueUsd: number;
  miningOperatingCostUsd: number;
  fleetBookValueUsd: number;
  deployedCapitalUsd: number | null;
  btcPriceSource: DataSource;
  networkSource: DataSource;
}): OwnerKpiSet {
  const profit = args.miningRevenueUsd - args.miningOperatingCostUsd;
  const miningDeps = [
    { label: 'BTC Price', source: args.btcPriceSource },
    { label: 'Network Hashrate', source: args.networkSource },
    { label: 'Miner Hashrate', source: args.hashrateSource },
    { label: 'Pool Fee', source: DS.MODELED },
  ];
  const roc =
    args.deployedCapitalUsd != null && args.deployedCapitalUsd > 0
      ? (profit * 12) / args.deployedCapitalUsd
      : null;

  return {
    totalNav: derived(args.navUsd, [
      { label: 'BTC Price', source: args.btcPriceSource },
      { label: 'BTC Treasury', source: DS.MANUAL },
      { label: 'Cash', source: DS.MANUAL },
      { label: 'Fleet Book Value', source: DS.MANUAL },
      { label: 'Liabilities', source: DS.MANUAL },
    ]),
    btcTreasuryQty: { value: args.btcHoldings, source: DS.MANUAL },
    btcProduced: { value: args.btcProduced, source: args.btcProducedSource },
    operatingHashrateTh: {
      value: args.operatingHashrateTh,
      source: args.hashrateSource,
    },
    miningRevenueUsd: derived(args.miningRevenueUsd, miningDeps),
    miningOperatingCostUsd: derived(args.miningOperatingCostUsd, [
      { label: 'Electricity Rate', source: DS.MANUAL },
      { label: 'Hosting Fee', source: DS.MANUAL },
      { label: 'Miner Power', source: DS.MANUAL },
    ]),
    miningOperatingProfitUsd: derived(profit, miningDeps),
    fleetBookValueUsd: { value: args.fleetBookValueUsd, source: DS.MANUAL },
    deployedCapitalUsd: {
      value: args.deployedCapitalUsd ?? 0,
      source: DS.MANUAL,
    },
    returnOnDeployedMiningCapital: derived(roc, [
      ...miningDeps,
      { label: 'Deployed Capital', source: DS.MANUAL },
    ]),
  };
}

export function availableLedgerPeriods(
  slices: PeriodLedgerSlice[],
): LedgerPeriod[] {
  return slices.filter((s) => s.available).map((s) => s.period);
}
