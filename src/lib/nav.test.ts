import { describe, expect, it } from 'vitest';
import { DataSource } from '../domain/dataSource';
import type { TreasuryTransaction } from '../domain/types';
import { computeHistoricalNavClient, computeNav, holdingsAsOf } from './nav';

describe('computeNav', () => {
  it('values assets and subtracts liabilities', () => {
    const result = computeNav({
      btcHoldings: 2,
      btcPriceUsd: 50_000,
      btcPriceSource: DataSource.LIVE,
      btcCostBasisUsd: 60_000,
      cashUsd: 25_000,
      minerHardwareBookValueUsd: 40_000,
      otherAssetsUsd: 5_000,
      equipmentFinancingUsd: 10_000,
      hostingPayableUsd: 2_000,
      otherLiabilitiesUsd: 3_000,
      btcMinedLifetime: 0.5,
      btcPurchasedLifetime: 1.5,
    });

    expect(result.btcTreasuryMarketValueUsd).toBe(100_000);
    expect(result.grossAssetsUsd).toBe(170_000);
    expect(result.totalLiabilitiesUsd).toBe(15_000);
    expect(result.netAssetValueUsd).toBe(155_000);
    expect(result.btcUnrealizedPnlUsd).toBe(40_000);
    expect(result.btcProducedLifetime).toBe(0.5);
    expect(result.btcPurchasedLifetime).toBe(1.5);
    expect(result.sourced.nav.source).toBe(DataSource.DERIVED);
    expect(result.sourced.nav.dependencies?.some((d) => d.label === 'BTC Price')).toBe(
      true,
    );
  });
});

describe('historical NAV helpers', () => {
  const txs: TreasuryTransaction[] = [
    {
      id: '1',
      date: '2025-01-01',
      transactionType: 'BTC_MINED',
      asset: 'BTC',
      quantity: 0.5,
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
      createdAt: '',
    },
    {
      id: '2',
      date: '2025-02-01',
      transactionType: 'BTC_PURCHASE',
      asset: 'BTC',
      quantity: 0.25,
      unitPrice: 80_000,
      grossAmount: 20_000,
      fee: 0,
      counterparty: '',
      account: '',
      minerId: null,
      facilityId: null,
      memo: '',
      source: 'manual',
      externalReference: null,
      createdAt: '',
    },
  ];

  it('reconstructs holdings as of a date', () => {
    const mid = holdingsAsOf(txs, '2025-01-15');
    expect(mid.btcHoldings).toBeCloseTo(0.5);
    expect(mid.btcMined).toBeCloseTo(0.5);
    const later = holdingsAsOf(txs, '2025-03-01');
    expect(later.btcHoldings).toBeCloseTo(0.75);
    expect(later.btcPurchased).toBeCloseTo(0.25);
  });

  it('returns null NAV when price is unavailable', () => {
    const result = computeHistoricalNavClient({
      asOf: '2025-03-01',
      transactions: txs,
      btcPriceUsd: null,
      btcPriceSource: 'UNAVAILABLE',
      cashUsd: 1000,
      minerBookValueUsd: 0,
      otherAssetsUsd: 0,
      liabilitiesUsd: 0,
    });
    expect(result.insufficientData).toBe(true);
    expect(result.netAssetValueUsd).toBeNull();
  });
});
