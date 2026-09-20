/**
 * Append-only treasury transaction aggregation.
 *
 * Mined BTC is tracked separately from purchased BTC.
 * Cost basis is not assigned to mined coins.
 */

import type { TreasuryTransaction, TreasuryTransactionType } from '../domain/types';

const BTC_IN: readonly TreasuryTransactionType[] = [
  'BTC_MINED',
  'BTC_PURCHASE',
  'BTC_TRANSFER_IN',
];

const BTC_OUT: readonly TreasuryTransactionType[] = [
  'BTC_SALE',
  'BTC_TRANSFER_OUT',
];

const CASH_IN: readonly TreasuryTransactionType[] = [
  'CASH_CONTRIBUTION',
  'OTHER_INCOME',
  'BTC_SALE',
];

const CASH_OUT: readonly TreasuryTransactionType[] = [
  'CASH_WITHDRAWAL',
  'HARDWARE_PURCHASE',
  'HOSTING_PAYMENT',
  'ELECTRICITY_PAYMENT',
  'OTHER_EXPENSE',
  'BTC_PURCHASE',
];

export type LedgerPeriod = 'today' | '7d' | '30d' | 'ytd' | 'lifetime';

export interface PeriodWindow {
  id: LedgerPeriod;
  fromMs: number | null;
  toMs: number;
}

export function periodWindows(nowMs: number): PeriodWindow[] {
  const startOfToday = new Date(nowMs);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfYear = Date.UTC(startOfToday.getUTCFullYear(), 0, 1);
  return [
    { id: 'today', fromMs: startOfToday.getTime(), toMs: nowMs },
    { id: '7d', fromMs: nowMs - 7 * 86_400_000, toMs: nowMs },
    { id: '30d', fromMs: nowMs - 30 * 86_400_000, toMs: nowMs },
    { id: 'ytd', fromMs: startOfYear, toMs: nowMs },
    { id: 'lifetime', fromMs: null, toMs: nowMs },
  ];
}

export function inWindow(tx: TreasuryTransaction, window: PeriodWindow): boolean {
  const t = Date.parse(tx.date);
  if (!Number.isFinite(t) || t > window.toMs) return false;
  if (window.fromMs == null) return true;
  return t >= window.fromMs;
}

export interface TreasuryLedgerTotals {
  btcHoldings: number;
  btcMined: number;
  btcPurchased: number;
  btcSold: number;
  btcTransferredIn: number;
  btcTransferredOut: number;
  btcTransferred: number;
  /** Cost basis of purchased (and priced transfer-in) BTC remaining, USD. */
  purchasedCostBasisUsd: number;
  purchasedQtyRemaining: number;
  avgAcquisitionPriceUsd: number;
  cashReserveUsd: number;
  hardwarePurchasesUsd: number;
  hostingPaymentsUsd: number;
  electricityPaymentsUsd: number;
  otherExpensesUsd: number;
  otherIncomeUsd: number;
  transactionCount: number;
}

function netCash(tx: TreasuryTransaction): number {
  if (tx.asset === 'USD') {
    const amount = tx.grossAmount !== 0 ? tx.grossAmount : tx.quantity;
    if (CASH_IN.includes(tx.transactionType)) return amount - tx.fee;
    if (CASH_OUT.includes(tx.transactionType)) return -(amount + tx.fee);
    return 0;
  }
  if (tx.transactionType === 'BTC_PURCHASE') {
    const spent =
      tx.grossAmount > 0 ? tx.grossAmount : (tx.unitPrice ?? 0) * tx.quantity;
    return -(spent + tx.fee);
  }
  if (tx.transactionType === 'BTC_SALE') {
    const proceeds =
      tx.grossAmount > 0 ? tx.grossAmount : (tx.unitPrice ?? 0) * tx.quantity;
    return proceeds - tx.fee;
  }
  return 0;
}

function purchaseCost(tx: TreasuryTransaction): number {
  if (tx.transactionType === 'BTC_PURCHASE') {
    const spent =
      tx.grossAmount > 0 ? tx.grossAmount : (tx.unitPrice ?? 0) * tx.quantity;
    return spent + tx.fee;
  }
  if (tx.transactionType === 'BTC_TRANSFER_IN' && (tx.unitPrice ?? 0) > 0) {
    return (tx.unitPrice ?? 0) * tx.quantity + tx.fee;
  }
  return 0;
}

export function aggregateTreasuryLedger(
  transactions: TreasuryTransaction[],
): TreasuryLedgerTotals {
  let btcMined = 0;
  let btcPurchased = 0;
  let btcSold = 0;
  let btcTransferredIn = 0;
  let btcTransferredOut = 0;
  let purchasedQtyRemaining = 0;
  let purchasedCostBasisUsd = 0;
  let cashReserveUsd = 0;
  let hardwarePurchasesUsd = 0;
  let hostingPaymentsUsd = 0;
  let electricityPaymentsUsd = 0;
  let otherExpensesUsd = 0;
  let otherIncomeUsd = 0;

  const ordered = [...transactions].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );

  for (const tx of ordered) {
    cashReserveUsd += netCash(tx);

    if (tx.transactionType === 'BTC_MINED') {
      btcMined += tx.quantity;
    } else if (tx.transactionType === 'BTC_PURCHASE') {
      btcPurchased += tx.quantity;
      purchasedQtyRemaining += tx.quantity;
      purchasedCostBasisUsd += purchaseCost(tx);
    } else if (tx.transactionType === 'BTC_TRANSFER_IN') {
      btcTransferredIn += tx.quantity;
      const cost = purchaseCost(tx);
      if (cost > 0) {
        purchasedQtyRemaining += tx.quantity;
        purchasedCostBasisUsd += cost;
      }
    } else if (tx.transactionType === 'BTC_SALE') {
      btcSold += tx.quantity;
      if (purchasedQtyRemaining > 0) {
        const soldFromPurchased = Math.min(tx.quantity, purchasedQtyRemaining);
        const avg =
          purchasedQtyRemaining > 0
            ? purchasedCostBasisUsd / purchasedQtyRemaining
            : 0;
        purchasedCostBasisUsd -= avg * soldFromPurchased;
        purchasedQtyRemaining -= soldFromPurchased;
      }
    } else if (tx.transactionType === 'BTC_TRANSFER_OUT') {
      btcTransferredOut += tx.quantity;
      if (purchasedQtyRemaining > 0) {
        const outFromPurchased = Math.min(tx.quantity, purchasedQtyRemaining);
        const avg =
          purchasedQtyRemaining > 0
            ? purchasedCostBasisUsd / purchasedQtyRemaining
            : 0;
        purchasedCostBasisUsd -= avg * outFromPurchased;
        purchasedQtyRemaining -= outFromPurchased;
      }
    } else if (tx.transactionType === 'HARDWARE_PURCHASE') {
      hardwarePurchasesUsd += tx.grossAmount || tx.quantity;
    } else if (tx.transactionType === 'HOSTING_PAYMENT') {
      hostingPaymentsUsd += tx.grossAmount || tx.quantity;
    } else if (tx.transactionType === 'ELECTRICITY_PAYMENT') {
      electricityPaymentsUsd += tx.grossAmount || tx.quantity;
    } else if (tx.transactionType === 'OTHER_EXPENSE') {
      otherExpensesUsd += tx.grossAmount || tx.quantity;
    } else if (tx.transactionType === 'OTHER_INCOME') {
      otherIncomeUsd += tx.grossAmount || tx.quantity;
    }
  }

  const btcHoldings =
    btcMined +
    btcPurchased +
    btcTransferredIn -
    btcSold -
    btcTransferredOut;

  return {
    btcHoldings,
    btcMined,
    btcPurchased,
    btcSold,
    btcTransferredIn,
    btcTransferredOut,
    btcTransferred: btcTransferredIn - btcTransferredOut,
    purchasedCostBasisUsd: Math.max(0, purchasedCostBasisUsd),
    purchasedQtyRemaining: Math.max(0, purchasedQtyRemaining),
    avgAcquisitionPriceUsd:
      purchasedQtyRemaining > 0
        ? purchasedCostBasisUsd / purchasedQtyRemaining
        : 0,
    cashReserveUsd,
    hardwarePurchasesUsd,
    hostingPaymentsUsd,
    electricityPaymentsUsd,
    otherExpensesUsd,
    otherIncomeUsd,
    transactionCount: transactions.length,
  };
}

export interface PeriodLedgerSlice {
  period: LedgerPeriod;
  available: boolean;
  btcMined: number;
  btcPurchased: number;
  cashOutUsd: number;
  cashInUsd: number;
}

export function ledgerByPeriod(
  transactions: TreasuryTransaction[],
  nowMs: number = Date.now(),
): PeriodLedgerSlice[] {
  return periodWindows(nowMs).map((window) => {
    const slice = transactions.filter((tx) => inWindow(tx, window));
    const available = window.id === 'lifetime' ? transactions.length > 0 : slice.length > 0;
    let btcMined = 0;
    let btcPurchased = 0;
    let cashOutUsd = 0;
    let cashInUsd = 0;
    for (const tx of slice) {
      if (tx.transactionType === 'BTC_MINED') btcMined += tx.quantity;
      if (tx.transactionType === 'BTC_PURCHASE') btcPurchased += tx.quantity;
      const cash = netCash(tx);
      if (cash > 0) cashInUsd += cash;
      if (cash < 0) cashOutUsd += -cash;
    }
    return {
      period: window.id,
      available,
      btcMined,
      btcPurchased,
      cashOutUsd,
      cashInUsd,
    };
  });
}

export function hasHistoricalOperatingData(
  transactions: TreasuryTransaction[],
  minerId?: string,
): boolean {
  return transactions.some((tx) => {
    if (minerId && tx.minerId && tx.minerId !== minerId) return false;
    return (
      tx.transactionType === 'BTC_MINED' ||
      tx.transactionType === 'HOSTING_PAYMENT' ||
      tx.transactionType === 'ELECTRICITY_PAYMENT'
    );
  });
}

export const BTC_IN_TYPES = BTC_IN;
export const BTC_OUT_TYPES = BTC_OUT;
