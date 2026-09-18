import { useId } from 'react';
import type { AccumulationPoint } from '../config/forge.config';
import { formatBtc } from '../lib/format';

interface AccumulationChartProps {
  data: AccumulationPoint[];
  targetBtc?: number;
}

const W = 640;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export function AccumulationChart({ data, targetBtc }: AccumulationChartProps) {
  const gradientId = useId();

  if (data.length === 0) {
    return <div className="chart chart--empty">No data</div>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxBtc = Math.max(...data.map((d) => d.btc), targetBtc ?? 0);
  const yMax = Math.ceil(maxBtc / 50) * 50 || 50;

  const x = (i: number) =>
    PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.btc).toFixed(1)}`)
    .join(' ');

  const areaPath =
    `${linePath} L ${x(data.length - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

  const gridValues = [0, yMax / 2, yMax];
  const last = data[data.length - 1];

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Bitcoin accumulation, currently ${formatBtc(last.btc)}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--btc)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--btc)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridValues.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            className="chart__grid"
          />
          <text x={PAD.left - 8} y={y(v) + 4} className="chart__ylabel">
            {v}
          </text>
        </g>
      ))}

      {targetBtc !== undefined && targetBtc <= yMax && (
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(targetBtc)}
          y2={y(targetBtc)}
          className="chart__target"
        />
      )}

      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} className="chart__line" fill="none" />

      <circle cx={x(data.length - 1)} cy={y(last.btc)} r={4} className="chart__dot" />

      {data.map((d, i) =>
        i % 2 === 0 || i === data.length - 1 ? (
          <text key={d.label} x={x(i)} y={H - 8} className="chart__xlabel">
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
