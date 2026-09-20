/**
 * Forge NAV engine.
 *
 * Assets and liabilities are explicit. Mining production math stays in
 * `src/lib/mining.ts` — this module only values what Forge owns and owes.
 */

import type { DataSource } from '../domain/dataSource';
import { DataSource as DS, derived, type SourcedValue } from '../domain/dataSource';

export interface NavInputs {
  btcHoldings: number;
  btcPriceUsd: number;
  btcPriceSource: DataSource;
  /** Purchased-BTC remaining cost basis (mined BTC excluded). */
  btcCostBasisUsd: number;
  cashUsd: number;
  minerHardwareBookValueUsd: number;
  otherAssetsUsd: number;
  equipmentFinancingUsd: number;
  hostingPayableUsd: number;
  otherLiabilitiesUsd: number;
  btcMinedLifetime: number;
  btcPurchasedLifetime: number;
}

export interface NavResult {
  btcTreasuryQty: number;
  btcTreasuryMarketValueUsd: number;
  btcAverageCostBasisUsd: number;
  btcUnrealizedPnlUsd: number;
  btcProducedLifetime: number;
  btcPurchasedLifetime: number;
  cashUsd: number;
  minerHardwareBookValueUsd: number;
  otherAssetsUsd: number;
  equipmentFinancingUsd: number;
  hostingPayableUsd: number;
  otherLiabilitiesUsd: number;
  grossAssetsUsd: number;
  totalLiabilitiesUsd: number;
  netAssetValueUsd: number;
  sourced: {
    nav: SourcedValue;
    btcMarketValue: SourcedValue;
    unrealizedPnl: SourcedValue;
  };
}

export function computeNav(inputs: NavInputs): NavResult {
  const btcTreasuryMarketValueUsd = inputs.btcHoldings * inputs.btcPriceUsd;
  const btcAverageCostBasisUsd =
    inputs.btcHoldings > 0 && inputs.btcCostBasisUsd > 0
      ? inputs.btcCostBasisUsd / inputs.btcHoldings
      : inputs.btcCostBasisUsd > 0 && inputs.btcPurchasedLifetime > 0
        ? inputs.btcCostBasisUsd / inputs.btcPurchasedLifetime
        : 0;
  const btcUnrealizedPnlUsd = btcTreasuryMarketValueUsd - inputs.btcCostBasisUsd;

  const grossAssetsUsd =
    btcTreasuryMarketValueUsd +
    inputs.cashUsd +
    inputs.minerHardwareBookValueUsd +
    inputs.otherAssetsUsd;

  const totalLiabilitiesUsd =
    Math.max(0, inputs.equipmentFinancingUsd) +
    Math.max(0, inputs.hostingPayableUsd) +
    Math.max(0, inputs.otherLiabilitiesUsd);

  const netAssetValueUsd = grossAssetsUsd - totalLiabilitiesUsd;

  const btcPriceDep = { label: 'BTC Price', source: inputs.btcPriceSource };
  const holdingsDep = { label: 'BTC Treasury', source: DS.MANUAL };
  const cashDep = { label: 'Cash', source: DS.MANUAL };
  const hwDep = { label: 'Fleet Book Value', source: DS.MANUAL };
  const liabDep = { label: 'Liabilities', source: DS.MANUAL };

  return {
    btcTreasuryQty: inputs.btcHoldings,
    btcTreasuryMarketValueUsd,
    btcAverageCostBasisUsd,
    btcUnrealizedPnlUsd,
    btcProducedLifetime: inputs.btcMinedLifetime,
    btcPurchasedLifetime: inputs.btcPurchasedLifetime,
    cashUsd: inputs.cashUsd,
    minerHardwareBookValueUsd: inputs.minerHardwareBookValueUsd,
    otherAssetsUsd: inputs.otherAssetsUsd,
    equipmentFinancingUsd: inputs.equipmentFinancingUsd,
    hostingPayableUsd: inputs.hostingPayableUsd,
    otherLiabilitiesUsd: inputs.otherLiabilitiesUsd,
    grossAssetsUsd,
    totalLiabilitiesUsd,
    netAssetValueUsd,
    sourced: {
      nav: derived(netAssetValueUsd, [
        btcPriceDep,
        holdingsDep,
        cashDep,
        hwDep,
        liabDep,
      ]),
      btcMarketValue: derived(btcTreasuryMarketValueUsd, [
        btcPriceDep,
        holdingsDep,
      ]),
      unrealizedPnl: derived(btcUnrealizedPnlUsd, [
        btcPriceDep,
        holdingsDep,
        { label: 'BTC Cost Basis', source: DS.MANUAL },
      ]),
    },
  };
}
