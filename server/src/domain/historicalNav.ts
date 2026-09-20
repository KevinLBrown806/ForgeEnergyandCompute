/**
 * Historical NAV reconstruction from durable ledger + market snapshots.
 */

import type { ForgeDb } from '../db/client.js';
import type { TreasuryTransaction } from '../domain/owner.js';
import { listLiabilities, getAssumptions } from '../db/repositories/settingsRepo.js';
import { listMiners } from '../db/repositories/assetRepo.js';
import {
  getTreasuryPosition,
  listTreasuryTransactions,
  reconstructBtcHoldingsFromLedger,
} from '../db/repositories/treasuryRepo.js';
import { nearestMarketPrice } from '../db/repositories/snapshotRepo.js';

export interface HistoricalNavResult {
  asOf: string;
  btcHoldings: number;
  btcPriceUsd: number;
  btcPriceSource: 'LIVE' | 'MANUAL' | 'MODELED' | 'UNAVAILABLE';
  btcMarketValueUsd: number;
  cashUsd: number;
  minerBookValueUsd: number;
  otherAssetsUsd: number;
  liabilitiesUsd: number;
  netAssetValueUsd: number | null;
  insufficientData: boolean;
  notes: string[];
  provenance: {
    btcHoldings: 'DERIVED' | 'MANUAL';
    btcPrice: 'LIVE' | 'UNAVAILABLE';
    cash: 'MANUAL';
    miners: 'MANUAL';
    liabilities: 'MANUAL';
  };
}

function txsAsOf(txs: TreasuryTransaction[], asOf: string): TreasuryTransaction[] {
  const end = Date.parse(asOf);
  return txs.filter((tx) => {
    const t = Date.parse(tx.date);
    return Number.isFinite(t) && t <= end;
  });
}

export function computeHistoricalNav(
  db: ForgeDb,
  asOf: string,
): HistoricalNavResult {
  const notes: string[] = [];
  const allTx = listTreasuryTransactions(db);
  const sliced = txsAsOf(allTx, asOf);
  const reconstructed = reconstructBtcHoldingsFromLedger(sliced);
  const price = nearestMarketPrice(db, asOf);
  const treasury = getTreasuryPosition(db);
  const assumptions = getAssumptions(db);
  const liabilities = listLiabilities(db).filter((l) => {
    if (l.active === false) return false;
    const asOfMs = Date.parse(l.asOf);
    return !Number.isFinite(asOfMs) || asOfMs <= Date.parse(asOf);
  });
  const miners = listMiners(db).filter(
    (m) => m.status !== 'sold' && m.status !== 'decommissioned',
  );

  const minerBook =
    treasury.minerHardwareBookValueUsd > 0
      ? treasury.minerHardwareBookValueUsd
      : miners.reduce((sum, m) => {
          const unit = m.acquisitionCostUsd ?? 0;
          const ship = m.shippingCostUsd ?? 0;
          const deploy = m.deploymentCostUsd ?? 0;
          return sum + unit * m.quantity + ship + deploy;
        }, 0);

  const liabilitiesUsd = liabilities.reduce(
    (sum, l) => sum + (l.outstandingPrincipalUsd ?? l.amountUsd),
    0,
  );

  const cashUsd = treasury.cashReserveUsd;
  const otherAssetsUsd = assumptions.otherAssetsUsd || treasury.otherAssetsUsd;

  let insufficientData = false;
  if (price.source === 'UNAVAILABLE') {
    notes.push('No historical market snapshot near this timestamp; BTC price unavailable.');
    insufficientData = true;
  }
  if (allTx.length === 0 && treasury.btcHoldings === 0) {
    notes.push('No treasury transactions; BTC holdings may be incomplete.');
  }

  const btcHoldings =
    allTx.length > 0 ? reconstructed.btcHoldings : treasury.btcHoldings;
  const btcMarketValueUsd =
    price.source === 'UNAVAILABLE' ? 0 : btcHoldings * price.btcUsd;

  const nav =
    insufficientData && price.source === 'UNAVAILABLE'
      ? null
      : btcMarketValueUsd + cashUsd + minerBook + otherAssetsUsd - liabilitiesUsd;

  if (nav == null) {
    notes.push('NAV not computed due to insufficient market data.');
  }

  return {
    asOf,
    btcHoldings,
    btcPriceUsd: price.btcUsd,
    btcPriceSource: price.source,
    btcMarketValueUsd,
    cashUsd,
    minerBookValueUsd: minerBook,
    otherAssetsUsd,
    liabilitiesUsd,
    netAssetValueUsd: nav,
    insufficientData,
    notes,
    provenance: {
      btcHoldings: allTx.length > 0 ? 'DERIVED' : 'MANUAL',
      btcPrice: price.source,
      cash: 'MANUAL',
      miners: 'MANUAL',
      liabilities: 'MANUAL',
    },
  };
}
