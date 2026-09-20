import { describe, expect, it } from 'vitest';
import type { TreasuryTransaction } from '../domain/types';
import {
  aggregateTreasuryLedger,
  hasHistoricalOperatingData,
  ledgerByPeriod,
} from './treasuryLedger';

function tx(
  overrides: Partial<TreasuryTransaction> &
    Pick<TreasuryTransaction, 'id' | 'transactionType' | 'quantity'>,
): TreasuryTransaction {
  return {
    date: '2026-03-01',
    asset: overrides.transactionType.startsWith('BTC') ? 'BTC' : 'USD',
    unitPrice: null,
    grossAmount: 0,
    fee: 0,
    counterparty: '',
    account: '',
    minerId: null,
    facilityId: null,
    memo: '',
    source: 'manual',
    externalReference: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('aggregateTreasuryLedger', () => {
  it('separates mined BTC from purchased BTC and cost basis', () => {
    const result = aggregateTreasuryLedger([
      tx({
        id: 'm1',
        transactionType: 'BTC_MINED',
        quantity: 0.4,
      }),
      tx({
        id: 'p1',
        transactionType: 'BTC_PURCHASE',
        quantity: 1,
        unitPrice: 50_000,
        grossAmount: 50_000,
        fee: 100,
      }),
      tx({
        id: 'c1',
        transactionType: 'CASH_CONTRIBUTION',
        quantity: 80_000,
        grossAmount: 80_000,
        asset: 'USD',
      }),
    ]);

    expect(result.btcMined).toBeCloseTo(0.4);
    expect(result.btcPurchased).toBe(1);
    expect(result.btcHoldings).toBeCloseTo(1.4);
    expect(result.purchasedCostBasisUsd).toBeCloseTo(50_100);
    expect(result.avgAcquisitionPriceUsd).toBeCloseTo(50_100);
    expect(result.cashReserveUsd).toBeCloseTo(80_000 - 50_100);
  });

  it('reduces purchased cost basis on sale without assigning cost to mined BTC', () => {
    const result = aggregateTreasuryLedger([
      tx({ id: 'm1', transactionType: 'BTC_MINED', quantity: 1 }),
      tx({
        id: 'p1',
        transactionType: 'BTC_PURCHASE',
        quantity: 1,
        grossAmount: 40_000,
      }),
      tx({
        id: 's1',
        transactionType: 'BTC_SALE',
        quantity: 0.5,
        grossAmount: 30_000,
        date: '2026-04-01',
      }),
    ]);

    expect(result.btcHoldings).toBeCloseTo(1.5);
    expect(result.btcSold).toBeCloseTo(0.5);
    expect(result.purchasedQtyRemaining).toBeCloseTo(0.5);
    expect(result.purchasedCostBasisUsd).toBeCloseTo(20_000);
    expect(result.cashReserveUsd).toBeCloseTo(30_000 - 40_000);
  });

  it('only reports periods that have source transactions', () => {
    const slices = ledgerByPeriod(
      [
        tx({
          id: 'old',
          transactionType: 'BTC_MINED',
          quantity: 0.1,
          date: '2025-01-01',
        }),
      ],
      Date.parse('2026-09-20T00:00:00.000Z'),
    );
    const today = slices.find((s) => s.period === 'today');
    const lifetime = slices.find((s) => s.period === 'lifetime');
    expect(today?.available).toBe(false);
    expect(lifetime?.available).toBe(true);
    expect(lifetime?.btcMined).toBeCloseTo(0.1);
  });

  it('requires operating history before treating recovery as available', () => {
    expect(hasHistoricalOperatingData([])).toBe(false);
    expect(
      hasHistoricalOperatingData([
        tx({
          id: 'h1',
          transactionType: 'HOSTING_PAYMENT',
          quantity: 100,
          grossAmount: 100,
          minerId: 'a',
        }),
      ]),
    ).toBe(true);
  });
});
