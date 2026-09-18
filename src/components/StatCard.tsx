import type { ReactNode } from 'react';

export type StatTone = 'default' | 'btc' | 'positive' | 'negative';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
      {hint !== undefined && <p className="stat-card__hint">{hint}</p>}
    </div>
  );
}
