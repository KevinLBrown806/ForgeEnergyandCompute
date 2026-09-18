import { describe, expect, it } from 'vitest';
import { allocateCapital, allocationTotalPct } from './capital';

const slices = [
  { label: 'Bitcoin', pct: 0.45 },
  { label: 'Mining hardware', pct: 0.3 },
  { label: 'Energy infrastructure', pct: 0.15 },
  { label: 'Cash / dry powder', pct: 0.1 },
];

describe('allocateCapital', () => {
  it('maps percentages onto a total dollar figure', () => {
    const lines = allocateCapital(8_000_000, slices);
    expect(lines).toHaveLength(4);
    expect(lines[0].usd).toBe(3_600_000);
    expect(lines[1].usd).toBe(2_400_000);
    expect(lines[2].usd).toBe(1_200_000);
    expect(lines[3].usd).toBe(800_000);
  });
});

describe('allocationTotalPct', () => {
  it('sums slice percentages', () => {
    expect(allocationTotalPct(slices)).toBeCloseTo(1, 6);
  });
});
