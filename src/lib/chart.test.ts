import { describe, expect, it } from 'vitest';
import { chartYMax } from './chart';

describe('chartYMax', () => {
  it('keeps current holdings readable instead of scaling to a distant target', () => {
    expect(chartYMax(42.5)).toBe(50);
  });

  it('returns a positive ceiling for empty/zero series', () => {
    expect(chartYMax(0)).toBe(10);
  });
});
