const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatUsd(value: number): string {
  return usd0.format(value);
}

export function formatUsdPrecise(value: number): string {
  return usd2.format(value);
}

/** Compact currency, e.g. $2.7M, $1.3B. Falls back to whole dollars < 1000. */
export function formatUsdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return formatUsd(value);
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

export function formatBtc(value: number, digits = 2): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} BTC`;
}

/** Hashrate given in TH/s, scaled to TH/PH/EH as appropriate. */
export function formatHashrate(thPerS: number): string {
  if (thPerS >= 1_000_000) return `${(thPerS / 1_000_000).toFixed(2)} EH/s`;
  if (thPerS >= 1_000) return `${(thPerS / 1_000).toFixed(2)} PH/s`;
  return `${num0.format(thPerS)} TH/s`;
}

/** Power given in kW, scaled to kW/MW as appropriate. */
export function formatPowerKw(kw: number): string {
  if (kw >= 1_000) return `${(kw / 1_000).toFixed(2)} MW`;
  return `${formatNumber(kw)} kW`;
}

export function formatMw(mw: number): string {
  return `${mw.toLocaleString('en-US', { maximumFractionDigits: 1 })} MW`;
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatJTh(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} J/TH`;
}

/** Metric tonnes label, used for the secondary carbon metric. */
export function formatTonnes(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} t`;
}
