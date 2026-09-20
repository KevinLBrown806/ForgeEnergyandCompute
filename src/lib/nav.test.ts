import { describe, expect, it } from 'vitest';
import { DataSource } from '../domain/dataSource';
import { computeNav } from './nav';

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
