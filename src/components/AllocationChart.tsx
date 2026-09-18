import type { AllocationSlice } from '../config/forge.config';
import { allocateCapital } from '../lib/capital';
import { formatPercent, formatUsdCompact } from '../lib/format';

interface AllocationChartProps {
  slices: readonly AllocationSlice[];
  totalUsd: number;
}

const COLORS = ['var(--btc)', 'var(--steel)', 'var(--pos)', 'var(--slate)'];
const SIZE = 200;
const R = 74;
const STROKE = 22;
const CIRC = 2 * Math.PI * R;
const GAP = 3;

export function AllocationChart({ slices, totalUsd }: AllocationChartProps) {
  const lines = allocateCapital(totalUsd, slices);
  const arcs = lines.reduce<{ line: (typeof lines)[number]; dash: number; offset: number }[]>(
    (acc, line) => {
      const prev = acc.length > 0 ? acc[acc.length - 1] : undefined;
      const offset = prev ? prev.offset + prev.dash + GAP : 0;
      acc.push({ line, dash: Math.max(line.pct * CIRC - GAP, 0), offset });
      return acc;
    },
    [],
  );

  return (
    <div className="allocation">
      <div className="allocation__visual">
        <svg
          className="allocation__chart"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Capital allocation breakdown"
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map(({ line, dash, offset }, i) => (
              <circle
                key={line.label}
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
        <div className="allocation__center">
          <span className="allocation__center-label">AUM</span>
          <span className="allocation__center-value">{formatUsdCompact(totalUsd)}</span>
        </div>
      </div>

      <ul className="allocation__legend">
        {lines.map((line, i) => (
          <li key={line.label}>
            <span
              className="allocation__swatch"
              style={{ background: COLORS[i % COLORS.length] }}
              aria-hidden="true"
            />
            <span className="allocation__label">{line.label}</span>
            <span className="allocation__usd">{formatUsdCompact(line.usd)}</span>
            <span className="allocation__pct">{formatPercent(line.pct, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
