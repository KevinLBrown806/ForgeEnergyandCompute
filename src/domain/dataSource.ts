/**
 * Data provenance for Forge OS metrics.
 *
 * LIVE    — automatically sourced from an external system (e.g. Braiins)
 * MANUAL  — entered from Forge company records (config or operator input)
 * MODELED — calculated using assumptions, scenarios, or derived economics
 *
 * Metrics must never present modeled figures as live actuals.
 */

export const DataSource = {
  LIVE: 'LIVE',
  MANUAL: 'MANUAL',
  MODELED: 'MODELED',
} as const;

export type DataSource = (typeof DataSource)[keyof typeof DataSource];

export const DATA_SOURCE_LABEL: Record<DataSource, string> = {
  LIVE: 'LIVE',
  MANUAL: 'MANUAL',
  MODELED: 'MODELED',
};

export const DATA_SOURCE_DESCRIPTION: Record<DataSource, string> = {
  LIVE: 'Automatically sourced from an external system',
  MANUAL: 'Entered from Forge company records',
  MODELED: 'Calculated using assumptions or scenarios',
};

/** Tagged value that carries its provenance with the number. */
export interface SourcedValue<T = number> {
  value: T;
  source: DataSource;
}

export function sourced<T>(value: T, source: DataSource): SourcedValue<T> {
  return { value, source };
}
