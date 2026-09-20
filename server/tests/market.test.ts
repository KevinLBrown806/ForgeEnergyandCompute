import { describe, expect, it } from 'vitest';
import {
  blockSubsidyBtc,
  estimateDaysUntilAdjustment,
} from '../src/services/market.js';

describe('block subsidy from height', () => {
  it('returns 3.125 BTC in the current era', () => {
    expect(blockSubsidyBtc(840_000)).toBe(3.125);
    expect(blockSubsidyBtc(900_000)).toBe(3.125);
  });

  it('halves at era boundaries', () => {
    expect(blockSubsidyBtc(0)).toBe(50);
    expect(blockSubsidyBtc(209_999)).toBe(50);
    expect(blockSubsidyBtc(210_000)).toBe(25);
  });
});

describe('days until difficulty adjustment', () => {
  it('prefers remaining blocks at 144 blocks/day', () => {
    expect(estimateDaysUntilAdjustment(144, 86_400_000)).toBe(1);
  });

  it('falls back to remainingTime as milliseconds', () => {
    expect(estimateDaysUntilAdjustment(undefined, 2 * 86_400_000)).toBe(2);
  });
});
