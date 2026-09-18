/** Round up to a chart-friendly ceiling so a series uses the plot area. */
export function chartYMax(dataMax: number): number {
  if (dataMax <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(dataMax));
  const nice = [1, 2, 2.5, 5, 10];
  for (const n of nice) {
    const candidate = n * mag;
    if (candidate >= dataMax * 1.08) return candidate;
  }
  return 10 * mag;
}
