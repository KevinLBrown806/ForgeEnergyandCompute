import type { ReactNode } from 'react';

export type StatTone = 'default' | 'btc' | 'positive' | 'negative';
export type StatSemantics = 'actual' | 'derived' | 'forecast' | 'manual' | 'plan';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  /** Explicit ACTUAL / DERIVED / FORECAST (or manual/plan) marker. */
  semantics?: StatSemantics;
}

const SEMANTICS_LABEL: Record<StatSemantics, string> = {
  actual: 'ACTUAL',
  derived: 'DERIVED',
  forecast: 'FORECAST',
  manual: 'MANUAL',
  plan: 'PLAN',
};

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  semantics,
}: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__head">
        <p className="stat-card__label">{label}</p>
        {semantics && (
          <span className={`semantics semantics--${semantics}`}>
            {SEMANTICS_LABEL[semantics]}
          </span>
        )}
      </div>
      <p className="stat-card__value">{value}</p>
      {hint !== undefined && <p className="stat-card__hint">{hint}</p>}
    </div>
  );
}
