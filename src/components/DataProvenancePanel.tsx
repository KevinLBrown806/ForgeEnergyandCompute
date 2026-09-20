import { useState } from 'react';
import {
  DATA_SOURCE_DESCRIPTION,
  DataSource,
  type ProvenanceDependency,
} from '../domain/dataSource';

const ORDER: DataSource[] = [
  DataSource.LIVE,
  DataSource.MANUAL,
  DataSource.MODELED,
  DataSource.DERIVED,
];

export interface ProvenanceMetric {
  label: string;
  source: DataSource;
  dependencies?: ProvenanceDependency[];
}

/** Compact legend explaining metric provenance. */
export function DataProvenancePanel({
  metrics = [],
}: {
  metrics?: ProvenanceMetric[];
}) {
  const [open, setOpen] = useState(false);
  const inspectable = metrics.filter((m) => m.dependencies?.length);

  return (
    <aside className="provenance" aria-label="Data provenance legend">
      <p className="provenance__title">Data provenance</p>
      <ul className="provenance__list">
        {ORDER.map((source) => (
          <li key={source} className="provenance__item">
            <span className={`semantics semantics--${source.toLowerCase()}`}>
              {source}
            </span>
            <span className="provenance__desc">
              {DATA_SOURCE_DESCRIPTION[source]}
            </span>
          </li>
        ))}
      </ul>
      {inspectable.length > 0 && (
        <div className="provenance__inspect">
          <button
            className="stat-card__inspect"
            type="button"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide metric sources' : 'Inspect metric sources'}
          </button>
          {open && (
            <ul className="provenance__metrics">
              {inspectable.map((metric) => (
                <li key={metric.label}>
                  <strong>{metric.label}</strong>
                  <span> DERIVED FROM </span>
                  {metric.dependencies!.map((dep, i) => (
                    <span key={dep.label}>
                      {i > 0 ? ' · ' : ''}
                      {dep.label} — {dep.source}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
