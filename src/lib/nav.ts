/**
 * Forge NAV engine.
 *
 * Assets and liabilities are explicit. Mining production math stays in
 * `src/lib/mining.ts` — this module only values what Forge owns and owes.
 */

import type { DataSource } from '../domain/dataSource';
import { DataSource as DS, derived, type SourcedValue } from '../domain/dataSource';
import type { TreasuryTransaction } from '../domain/types';

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

/**
 * Reconstruct BTC holdings from ledger as-of a timestamp (client-side helper).
 * Historical market price must be supplied separately (from durable snapshots).
 */
export function holdingsAsOf(
  transactions: TreasuryTransaction[],
  asOfIso: string,
): {
  btcHoldings: number;
  btcMined: number;
  btcPurchased: number;
  insufficient: boolean;
} {
  const end = Date.parse(asOfIso);
  if (!Number.isFinite(end)) {
    return { btcHoldings: 0, btcMined: 0, btcPurchased: 0, insufficient: true };
  }
  let btcHoldings = 0;
  let btcMined = 0;
  let btcPurchased = 0;
  for (const tx of transactions) {
    const t = Date.parse(tx.date);
    if (!Number.isFinite(t) || t > end) continue;
    if (tx.asset !== 'BTC') continue;
    switch (tx.transactionType) {
      case 'BTC_MINED':
        btcMined += tx.quantity;
        btcHoldings += tx.quantity;
        break;
      case 'BTC_PURCHASE':
        btcPurchased += tx.quantity;
        btcHoldings += tx.quantity;
        break;
      case 'BTC_TRANSFER_IN':
        btcHoldings += tx.quantity;
        break;
      case 'BTC_SALE':
      case 'BTC_TRANSFER_OUT':
        btcHoldings -= tx.quantity;
        break;
      case 'REVERSAL':
      case 'ADJUSTMENT':
        btcHoldings += tx.quantity;
        break;
      default:
        break;
    }
  }
  return {
    btcHoldings,
    btcMined,
    btcPurchased,
    insufficient: transactions.length === 0,
  };
}

export function computeHistoricalNavClient(input: {
  asOf: string;
  transactions: TreasuryTransaction[];
  btcPriceUsd: number | null;
  btcPriceSource: DataSource | 'UNAVAILABLE';
  cashUsd: number;
  minerBookValueUsd: number;
  otherAssetsUsd: number;
  liabilitiesUsd: number;
}): {
  netAssetValueUsd: number | null;
  insufficientData: boolean;
  notes: string[];
} {
  const notes: string[] = [];
  const holdings = holdingsAsOf(input.transactions, input.asOf);
  if (input.btcPriceUsd == null || input.btcPriceSource === 'UNAVAILABLE') {
    notes.push('No market price for this timestamp.');
    return { netAssetValueUsd: null, insufficientData: true, notes };
  }
  if (holdings.insufficient) {
    notes.push('No treasury transactions; holdings may be incomplete.');
  }
  const nav =
    holdings.btcHoldings * input.btcPriceUsd +
    input.cashUsd +
    input.minerBookValueUsd +
    input.otherAssetsUsd -
    input.liabilitiesUsd;
  return { netAssetValueUsd: nav, insufficientData: false, notes };
}
