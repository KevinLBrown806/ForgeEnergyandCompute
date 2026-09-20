import type { ReactNode } from 'react';
import {
  DATA_SOURCE_LABEL,
  type DataSource,
} from '../domain/dataSource';

export type StatTone = 'default' | 'btc' | 'positive' | 'negative';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  /** LIVE / MANUAL / MODELED provenance badge. */
  source?: DataSource;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  source,
}: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__head">
        <p className="stat-card__label">{label}</p>
        {source && (
          <span className={`semantics semantics--${source.toLowerCase()}`}>
            {DATA_SOURCE_LABEL[source]}
          </span>
        )}
      </div>
      <p className="stat-card__value">{value}</p>
      {hint !== undefined && <p className="stat-card__hint">{hint}</p>}
    </div>
  );
}
