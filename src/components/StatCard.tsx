import { useState, type ReactNode } from 'react';
import {
  DATA_SOURCE_LABEL,
  type DataSource,
  type ProvenanceDependency,
} from '../domain/dataSource';

export type StatTone = 'default' | 'btc' | 'positive' | 'negative';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  /** LIVE / MANUAL / MODELED / DERIVED provenance badge. */
  source?: DataSource;
  dependencies?: ProvenanceDependency[];
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  source,
  dependencies,
}: StatCardProps) {
  const [open, setOpen] = useState(false);
  const inspectable = Boolean(dependencies?.length);

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
      {inspectable && (
        <div className="stat-card__trace">
          <button
            className="stat-card__inspect"
            type="button"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide source' : 'Inspect source'}
          </button>
          {open && (
            <ul className="stat-card__deps">
              <li>DERIVED FROM</li>
              {dependencies!.map((dep) => (
                <li key={dep.label}>
                  {dep.label} — {dep.source}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
