import { describe, expect, it } from 'vitest';
import { validateMinerAsset, validateTreasuryTransaction } from './validation';
import { createEmptyMinerInput } from '../config/demoFleet';

describe('owner input validation', () => {
  it('rejects negative miner quantity and impossible efficiency', () => {
    expect(() =>
      validateMinerAsset({
        ...createEmptyMinerInput(),
        model: 'S21',
        serialNumber: 'A',
        quantity: -1,
      }),
    ).toThrow(/quantity/i);
    expect(() =>
      validateMinerAsset({
        ...createEmptyMinerInput(),
        serialNumber: 'A',
        model: 'S21',
        efficiencyJTh: 0,
      }),
    ).toThrow(/efficiency/i);
    expect(() =>
      validateMinerAsset({
        ...createEmptyMinerInput(),
        serialNumber: 'A',
        model: 'S21',
        electricityRatePerKwh: 0,
      }),
    ).toThrow(/electricity/i);
  });

  it('rejects malformed dates and duplicate transaction ids', () => {
    expect(() =>
      validateMinerAsset({
        ...createEmptyMinerInput(),
        serialNumber: 'A',
        model: 'S21',
        acquisitionDate: 'not-a-date',
      }),
    ).toThrow(/date/i);
    expect(() =>
      validateTreasuryTransaction(
        {
          id: 'dup',
          date: '2026-01-01',
          transactionType: 'BTC_MINED',
          asset: 'BTC',
          quantity: 0.1,
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
        },
        new Set(['dup']),
      ),
    ).toThrow(/duplicate transaction/i);
  });
});
