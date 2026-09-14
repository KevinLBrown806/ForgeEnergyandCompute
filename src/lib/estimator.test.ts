import { describe, expect, it } from 'vitest';
import { estimate, formatUsd, type EstimatorInputs } from './estimator';

const base: EstimatorInputs = {
  gpuCount: 1000,
  wattsPerGpu: 1000,
  hoursPerDay: 24,
  pricePerKwh: 0.1,
  pue: 1.0,
  carbonKgPerKwh: 0.5,
};

describe('estimate', () => {
  it('computes facility draw including PUE overhead', () => {
    const result = estimate({ ...base, pue: 1.2 });
    // 1000 GPUs * 1000 W = 1000 kW IT load, * 1.2 PUE = 1200 kW facility.
    expect(result.facilityKw).toBeCloseTo(1200, 5);
  });

  it('computes monthly energy from facility draw', () => {
    const result = estimate(base);
    // 1000 kW * 24 h * 30.437 days.
    expect(result.monthlyKwh).toBeCloseTo(1000 * 24 * 30.437, 3);
  });

  it('derives cost and carbon from monthly energy', () => {
    const result = estimate(base);
    expect(result.monthlyCost).toBeCloseTo(result.monthlyKwh * 0.1, 6);
    expect(result.monthlyCo2Tonnes).toBeCloseTo(
      (result.monthlyKwh * 0.5) / 1000,
      6,
    );
  });

  it('scales linearly with GPU count', () => {
    const one = estimate({ ...base, gpuCount: 500 });
    const two = estimate({ ...base, gpuCount: 1000 });
    expect(two.monthlyCost).toBeCloseTo(one.monthlyCost * 2, 6);
  });
});

describe('formatUsd', () => {
  it('formats whole-dollar currency', () => {
    expect(formatUsd(1234.56)).toBe('$1,235');
  });
});
