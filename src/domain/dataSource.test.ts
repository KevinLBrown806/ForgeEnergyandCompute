import { describe, expect, it } from 'vitest';
import { DataSource, derived, sourced } from './dataSource';

describe('provenance propagation', () => {
  it('tags derived metrics with their LIVE / MANUAL / MODELED dependencies', () => {
    const metric = derived(123, [
      { label: 'BTC Price', source: DataSource.LIVE },
      { label: 'Network Hashrate', source: DataSource.LIVE },
      { label: 'Miner Hashrate', source: DataSource.LIVE },
      { label: 'Pool Fee', source: DataSource.MODELED },
    ]);
    expect(metric.source).toBe(DataSource.DERIVED);
    expect(metric.value).toBe(123);
    expect(metric.dependencies).toHaveLength(4);
    expect(metric.dependencies?.map((d) => d.source)).toEqual([
      DataSource.LIVE,
      DataSource.LIVE,
      DataSource.LIVE,
      DataSource.MODELED,
    ]);
  });

  it('keeps a simple sourced value without inventing dependencies', () => {
    const live = sourced(380, DataSource.LIVE);
    expect(live.dependencies).toBeUndefined();
    expect(live.source).toBe(DataSource.LIVE);
  });
});
