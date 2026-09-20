/**
 * Data provenance for Forge OS metrics.
 *
 * LIVE    — automatically sourced from an external system (e.g. Braiins, spot)
 * MANUAL  — entered from Forge company records (config or operator input)
 * MODELED — calculated using assumptions or scenarios
 * DERIVED — computed from other sourced inputs (keeps dependency trace)
 *
 * Metrics must never present modeled figures as live actuals.
 */

export const DataSource = {
  LIVE: 'LIVE',
  MANUAL: 'MANUAL',
  MODELED: 'MODELED',
  DERIVED: 'DERIVED',
} as const;

export type DataSource = (typeof DataSource)[keyof typeof DataSource];

export const DATA_SOURCE_LABEL: Record<DataSource, string> = {
  LIVE: 'LIVE',
  MANUAL: 'MANUAL',
  MODELED: 'MODELED',
  DERIVED: 'DERIVED',
};

export const DATA_SOURCE_DESCRIPTION: Record<DataSource, string> = {
  LIVE: 'Automatically sourced from a verified external system',
  MANUAL: 'Entered from Forge company records',
  MODELED: 'Calculated using assumptions or scenarios',
  DERIVED: 'Computed from other LIVE, MANUAL, or MODELED inputs',
};

/** One input a derived metric depends on. */
export interface ProvenanceDependency {
  label: string;
  source: DataSource;
}

/** Tagged value that carries its provenance with the number. */
export interface SourcedValue<T = number> {
  value: T;
  source: DataSource;
  /** Present when source is DERIVED (and optionally for others). */
  dependencies?: ProvenanceDependency[];
}

export function sourced<T>(
  value: T,
  source: DataSource,
  dependencies?: ProvenanceDependency[],
): SourcedValue<T> {
  return dependencies && dependencies.length > 0
    ? { value, source, dependencies }
    : { value, source };
}

/**
 * A derived metric is DERIVED when it has dependencies.
 * Overall source stays DERIVED; callers inspect dependencies for LIVE/MANUAL/MODELED mix.
 */
export function derived<T>(
  value: T,
  dependencies: ProvenanceDependency[],
): SourcedValue<T> {
  return { value, source: DataSource.DERIVED, dependencies };
}

/** Worst-case (least live) source among dependencies — for rollup badges. */
export function rollupSource(dependencies: ProvenanceDependency[]): DataSource {
  if (dependencies.length === 0) return DataSource.DERIVED;
  if (dependencies.some((d) => d.source === DataSource.MODELED)) {
    return DataSource.DERIVED;
  }
  if (dependencies.some((d) => d.source === DataSource.MANUAL)) {
    return DataSource.DERIVED;
  }
  if (dependencies.every((d) => d.source === DataSource.LIVE)) {
    return DataSource.DERIVED;
  }
  return DataSource.DERIVED;
}
