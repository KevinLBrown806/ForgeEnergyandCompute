/**
 * Cumulative capital recovery from actual treasury transactions.
 * Never fabricates history from modeled monthly profit.
 */

import type { MinerAsset, TreasuryTransaction } from './types';
import { minerTotalCostBasisUsd } from './ledger';
import { hasHistoricalOperatingData } from '../lib/treasuryLedger';

export interface CapitalRecoveryRow {
  minerId: string;
  sufficientHistory: boolean;
  cumulativeBtcProduced: number | null;
  cumulativeMiningRevenueUsd: number | null;
  cumulativeOperatingCostUsd: number | null;
  cumulativeContributionUsd: number | null;
  capitalRecoveredPct: number | null;
  remainingUnrecoveredUsd: number | null;
}

function txsForMiner(
  transactions: TreasuryTransaction[],
  minerId: string,
): TreasuryTransaction[] {
  const direct = transactions.filter((tx) => tx.minerId === minerId);
  if (direct.length) return direct;
  return [];
}

export function capitalRecoveryForMiner(
  asset: MinerAsset,
  transactions: TreasuryTransaction[],
): CapitalRecoveryRow {
  const txs = txsForMiner(transactions, asset.id);
  const sufficient = hasHistoricalOperatingData(txs, asset.id);
  if (!sufficient) {
    return {
      minerId: asset.id,
      sufficientHistory: false,
      cumulativeBtcProduced: null,
      cumulativeMiningRevenueUsd: null,
      cumulativeOperatingCostUsd: null,
      cumulativeContributionUsd: null,
      capitalRecoveredPct: null,
      remainingUnrecoveredUsd: null,
    };
  }

  let btc = 0;
  let revenue = 0;
  let opex = 0;
  for (const tx of txs) {
    if (tx.transactionType === 'BTC_MINED') {
      btc += tx.quantity;
      revenue += tx.grossAmount > 0 ? tx.grossAmount : (tx.unitPrice ?? 0) * tx.quantity;
    }
    if (
      tx.transactionType === 'HOSTING_PAYMENT' ||
      tx.transactionType === 'ELECTRICITY_PAYMENT'
    ) {
      opex += tx.grossAmount || tx.quantity;
    }
  }
  const contribution = revenue - opex;
  const capital = minerTotalCostBasisUsd(asset);
  const capitalRecoveredPct =
    capital != null && capital > 0 ? contribution / capital : null;
  const remainingUnrecoveredUsd =
    capital != null ? Math.max(0, capital - contribution) : null;

  return {
    minerId: asset.id,
    sufficientHistory: true,
    cumulativeBtcProduced: btc,
    cumulativeMiningRevenueUsd: revenue,
    cumulativeOperatingCostUsd: opex,
    cumulativeContributionUsd: contribution,
    capitalRecoveredPct,
    remainingUnrecoveredUsd,
  };
}

export function capitalRecoveryForFleet(
  assets: MinerAsset[],
  transactions: TreasuryTransaction[],
): CapitalRecoveryRow[] {
  return assets.map((asset) => capitalRecoveryForMiner(asset, transactions));
}
