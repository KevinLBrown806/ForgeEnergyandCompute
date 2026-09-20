import { describe, expect, it } from 'vitest';
import { capitalRecoveryForMiner } from './capitalRecovery';
import type { MinerAsset, TreasuryTransaction } from './types';

const asset = {
  id: 'miner-1',
  acquisitionCostUsd: 4000,
  shippingCostUsd: 0,
  deploymentCostUsd: 0,
  quantity: 1,
} as MinerAsset;

describe('capital recovery', () => {
  it('returns insufficient history when no operating transactions exist', () => {
    const row = capitalRecoveryForMiner(asset, []);
    expect(row.sufficientHistory).toBe(false);
    expect(row.cumulativeBtcProduced).toBeNull();
    expect(row.capitalRecoveredPct).toBeNull();
  });

  it('computes recovery from miner-linked operating history', () => {
    const txs = [
      {
        id: '1',
        date: '2026-01-01',
        transactionType: 'BTC_MINED',
        asset: 'BTC',
        quantity: 0.1,
        unitPrice: 60_000,
        grossAmount: 6_000,
        fee: 0,
        minerId: 'miner-1',
      },
      {
        id: '2',
        date: '2026-01-31',
        transactionType: 'ELECTRICITY_PAYMENT',
        asset: 'USD',
        quantity: 1_000,
        unitPrice: null,
        grossAmount: 1_000,
        fee: 0,
        minerId: 'miner-1',
      },
    ] as TreasuryTransaction[];

    const row = capitalRecoveryForMiner(asset, txs);
    expect(row.sufficientHistory).toBe(true);
    expect(row.cumulativeBtcProduced).toBeCloseTo(0.1);
    expect(row.cumulativeMiningRevenueUsd).toBe(6_000);
    expect(row.cumulativeOperatingCostUsd).toBe(1_000);
    expect(row.cumulativeContributionUsd).toBe(5_000);
    expect(row.capitalRecoveredPct).toBeCloseTo(5_000 / 4_000);
    expect(row.remainingUnrecoveredUsd).toBe(0);
  });
});
