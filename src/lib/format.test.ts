import { describe, expect, it } from 'vitest';
import {
  formatBtc,
  formatHashrate,
  formatPercent,
  formatPowerKw,
  formatUsd,
  formatUsdCompact,
} from './format';

describe('formatUsd', () => {
  it('formats whole-dollar currency', () => {
    expect(formatUsd(1234.56)).toBe('$1,235');
  });
});

describe('formatUsdCompact', () => {
  it('scales to millions and billions', () => {
    expect(formatUsdCompact(2_720_000)).toBe('$2.72M');
    expect(formatUsdCompact(1_300_000_000)).toBe('$1.30B');
  });

  it('uses whole dollars below a thousand', () => {
    expect(formatUsdCompact(750)).toBe('$750');
  });
});

describe('formatBtc', () => {
  it('formats BTC with a suffix', () => {
    expect(formatBtc(42.5)).toBe('42.50 BTC');
  });
});

describe('formatHashrate', () => {
  it('scales TH/s up to PH/s and EH/s', () => {
    expect(formatHashrate(500)).toBe('500 TH/s');
    expect(formatHashrate(190_200)).toBe('190.20 PH/s');
    expect(formatHashrate(2_000_000)).toBe('2.00 EH/s');
  });
});

describe('formatPowerKw', () => {
  it('scales kW up to MW', () => {
    expect(formatPowerKw(3153)).toBe('3.15 MW');
    expect(formatPowerKw(500)).toBe('500 kW');
  });
});

describe('formatPercent', () => {
  it('formats a fraction as a percentage', () => {
    expect(formatPercent(0.662)).toBe('66.2%');
  });
});
