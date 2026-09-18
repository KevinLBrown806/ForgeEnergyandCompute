import type { AllocationSlice } from '../config/forge.config';
import { formatPercent } from '../lib/format';

interface AllocationChartProps {
  slices: AllocationSlice[];
}

const COLORS = ['var(--btc)', '#4aa8ff', '#3ddc97', '#8b93a7'];
const SIZE = 200;
const R = 80;
const STROKE = 26;
const CIRC = 2 * Math.PI * R;

export function AllocationChart({ slices }: AllocationChartProps) {
  const arcs = slices.reduce<{ slice: AllocationSlice; dash: number; offset: number }[]>(
    (acc, slice) => {
      const prev = acc.length > 0 ? acc[acc.length - 1] : undefined;
      const offset = prev ? prev.offset + prev.dash : 0;
      acc.push({ slice, dash: slice.pct * CIRC, offset });
      return acc;
    },
    [],
  );

  return (
    <div className="allocation">
      <svg
        className="allocation__chart"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Capital allocation breakdown"
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map(({ slice, dash, offset }, i) => (
            <circle
              key={slice.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={-offset}
            />
          ))}
        </g>
      </svg>

      <ul className="allocation__legend">
        {slices.map((slice, i) => (
          <li key={slice.label}>
            <span
              className="allocation__swatch"
              style={{ background: COLORS[i % COLORS.length] }}
              aria-hidden="true"
            />
            <span className="allocation__label">{slice.label}</span>
            <span className="allocation__pct">{formatPercent(slice.pct, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
