import {
  DATA_SOURCE_DESCRIPTION,
  DataSource,
} from '../domain/dataSource';

const ORDER: DataSource[] = [
  DataSource.LIVE,
  DataSource.MANUAL,
  DataSource.MODELED,
];

/** Compact legend explaining metric provenance. */
export function DataProvenancePanel() {
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
    </aside>
  );
}
