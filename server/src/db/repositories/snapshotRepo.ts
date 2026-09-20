import type { ForgeDb } from '../client.js';
import { newId, nowIso } from '../client.js';
import type {
  MarketSnapshotRow,
  NetworkSnapshotRow,
  ProductionDaily,
} from '../../domain/owner.js';

export function insertMarketSnapshot(
  db: ForgeDb,
  input: {
    btcUsd: number | null;
    change24hPct: number | null;
    provider: string;
    sourceTimestamp: string | null;
    success: boolean;
    error: string | null;
    payload?: unknown;
  },
): MarketSnapshotRow {
  const row: MarketSnapshotRow = {
    id: newId('mkt'),
    btcUsd: input.btcUsd,
    change24hPct: input.change24hPct,
    provider: input.provider,
    sourceTimestamp: input.sourceTimestamp,
    ingestedAt: nowIso(),
    success: input.success,
    error: input.error,
  };
  db.prepare(
    `INSERT INTO market_snapshots (
      id, btc_usd, change_24h_pct, provider, source_timestamp, ingested_at, success, error, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.btcUsd,
    row.change24hPct,
    row.provider,
    row.sourceTimestamp,
    row.ingestedAt,
    row.success ? 1 : 0,
    row.error,
    input.payload == null ? null : JSON.stringify(input.payload),
  );
  return row;
}

export function listMarketSnapshots(
  db: ForgeDb,
  limit = 100,
): MarketSnapshotRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM market_snapshots ORDER BY ingested_at DESC LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string;
    btc_usd: number | null;
    change_24h_pct: number | null;
    provider: string;
    source_timestamp: string | null;
    ingested_at: string;
    success: number;
    error: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    btcUsd: r.btc_usd,
    change24hPct: r.change_24h_pct,
    provider: r.provider,
    sourceTimestamp: r.source_timestamp,
    ingestedAt: r.ingested_at,
    success: Boolean(r.success),
    error: r.error,
  }));
}

export function nearestMarketPrice(
  db: ForgeDb,
  atIso: string,
): { btcUsd: number; ingestedAt: string; source: 'LIVE' | 'UNAVAILABLE' } {
  const at = Date.parse(atIso);
  const rows = listMarketSnapshots(db, 500).filter(
    (r) => r.success && r.btcUsd != null,
  );
  if (!rows.length) {
    return { btcUsd: 0, ingestedAt: atIso, source: 'UNAVAILABLE' };
  }
  let best = rows[0];
  let bestDelta = Math.abs(Date.parse(best.ingestedAt) - at);
  for (const r of rows) {
    const d = Math.abs(Date.parse(r.ingestedAt) - at);
    if (d < bestDelta) {
      best = r;
      bestDelta = d;
    }
  }
  return {
    btcUsd: best.btcUsd ?? 0,
    ingestedAt: best.ingestedAt,
    source: 'LIVE',
  };
}

export function insertNetworkSnapshot(
  db: ForgeDb,
  input: {
    networkHashrateEhs: number | null;
    difficulty: number | null;
    blockHeight: number | null;
    blockSubsidyBtc: number | null;
    estimatedNextAdjustment: string | null;
    daysUntilAdjustment: number | null;
    provider: string;
    sourceTimestamp: string | null;
    success: boolean;
    error: string | null;
    payload?: unknown;
  },
): NetworkSnapshotRow {
  const row: NetworkSnapshotRow = {
    id: newId('net'),
    networkHashrateEhs: input.networkHashrateEhs,
    difficulty: input.difficulty,
    blockHeight: input.blockHeight,
    blockSubsidyBtc: input.blockSubsidyBtc,
    estimatedNextAdjustment: input.estimatedNextAdjustment,
    daysUntilAdjustment: input.daysUntilAdjustment,
    provider: input.provider,
    sourceTimestamp: input.sourceTimestamp,
    ingestedAt: nowIso(),
    success: input.success,
    error: input.error,
  };
  db.prepare(
    `INSERT INTO network_snapshots (
      id, network_hashrate_ehs, difficulty, block_height, block_subsidy_btc,
      estimated_next_adjustment, days_until_adjustment, provider, source_timestamp,
      ingested_at, success, error, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.networkHashrateEhs,
    row.difficulty,
    row.blockHeight,
    row.blockSubsidyBtc,
    row.estimatedNextAdjustment,
    row.daysUntilAdjustment,
    row.provider,
    row.sourceTimestamp,
    row.ingestedAt,
    row.success ? 1 : 0,
    row.error,
    input.payload == null ? null : JSON.stringify(input.payload),
  );
  return row;
}

export function listNetworkSnapshots(
  db: ForgeDb,
  limit = 100,
): NetworkSnapshotRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM network_snapshots ORDER BY ingested_at DESC LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string;
    network_hashrate_ehs: number | null;
    difficulty: number | null;
    block_height: number | null;
    block_subsidy_btc: number | null;
    estimated_next_adjustment: string | null;
    days_until_adjustment: number | null;
    provider: string;
    source_timestamp: string | null;
    ingested_at: string;
    success: number;
    error: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    networkHashrateEhs: r.network_hashrate_ehs,
    difficulty: r.difficulty,
    blockHeight: r.block_height,
    blockSubsidyBtc: r.block_subsidy_btc,
    estimatedNextAdjustment: r.estimated_next_adjustment,
    daysUntilAdjustment: r.days_until_adjustment,
    provider: r.provider,
    sourceTimestamp: r.source_timestamp,
    ingestedAt: r.ingested_at,
    success: Boolean(r.success),
    error: r.error,
  }));
}

export function upsertProductionDaily(
  db: ForgeDb,
  input: Omit<ProductionDaily, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
): ProductionDaily {
  const existing = db
    .prepare('SELECT * FROM production_daily WHERE date = ?')
    .get(input.date) as
    | {
        id: string;
        created_at: string;
      }
    | undefined;

  // Never promote MODELED into actual history
  if (existing && input.provenance === 'MODELED') {
    const row = db
      .prepare('SELECT * FROM production_daily WHERE date = ?')
      .get(input.date) as {
      id: string;
      date: string;
      btc_produced: number;
      pool_source: string;
      average_hashrate_th: number | null;
      uptime_pct: number | null;
      mining_revenue_usd: number | null;
      power_hosting_cost_usd: number | null;
      operating_profit_usd: number | null;
      provenance: string;
      notes: string;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      date: row.date,
      btcProduced: row.btc_produced,
      poolSource: row.pool_source,
      averageHashrateTh: row.average_hashrate_th,
      uptimePct: row.uptime_pct,
      miningRevenueUsd: row.mining_revenue_usd,
      powerHostingCostUsd: row.power_hosting_cost_usd,
      operatingProfitUsd: row.operating_profit_usd,
      provenance: row.provenance as ProductionDaily['provenance'],
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const ts = nowIso();
  const record: ProductionDaily = {
    id: existing?.id ?? input.id ?? newId('prod'),
    date: input.date,
    btcProduced: input.btcProduced,
    poolSource: input.poolSource,
    averageHashrateTh: input.averageHashrateTh,
    uptimePct: input.uptimePct,
    miningRevenueUsd: input.miningRevenueUsd,
    powerHostingCostUsd: input.powerHostingCostUsd,
    operatingProfitUsd: input.operatingProfitUsd,
    provenance: input.provenance,
    notes: input.notes,
    createdAt: existing?.created_at ?? ts,
    updatedAt: ts,
  };

  db.prepare(
    `INSERT INTO production_daily (
      id, date, btc_produced, pool_source, average_hashrate_th, uptime_pct,
      mining_revenue_usd, power_hosting_cost_usd, operating_profit_usd,
      provenance, notes, created_at, updated_at
    ) VALUES (
      @id, @date, @btcProduced, @poolSource, @averageHashrateTh, @uptimePct,
      @miningRevenueUsd, @powerHostingCostUsd, @operatingProfitUsd,
      @provenance, @notes, @createdAt, @updatedAt
    )
    ON CONFLICT(date) DO UPDATE SET
      btc_produced=excluded.btc_produced,
      pool_source=excluded.pool_source,
      average_hashrate_th=excluded.average_hashrate_th,
      uptime_pct=excluded.uptime_pct,
      mining_revenue_usd=excluded.mining_revenue_usd,
      power_hosting_cost_usd=excluded.power_hosting_cost_usd,
      operating_profit_usd=excluded.operating_profit_usd,
      provenance=excluded.provenance,
      notes=excluded.notes,
      updated_at=excluded.updated_at`,
  ).run(record);

  return record;
}

export function listProductionDaily(db: ForgeDb): ProductionDaily[] {
  const rows = db
    .prepare('SELECT * FROM production_daily ORDER BY date ASC')
    .all() as Array<{
    id: string;
    date: string;
    btc_produced: number;
    pool_source: string;
    average_hashrate_th: number | null;
    uptime_pct: number | null;
    mining_revenue_usd: number | null;
    power_hosting_cost_usd: number | null;
    operating_profit_usd: number | null;
    provenance: string;
    notes: string;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    btcProduced: r.btc_produced,
    poolSource: r.pool_source,
    averageHashrateTh: r.average_hashrate_th,
    uptimePct: r.uptime_pct,
    miningRevenueUsd: r.mining_revenue_usd,
    powerHostingCostUsd: r.power_hosting_cost_usd,
    operatingProfitUsd: r.operating_profit_usd,
    provenance: r.provenance as ProductionDaily['provenance'],
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function insertFleetSnapshot(
  db: ForgeDb,
  input: {
    minerId: string | null;
    workerName: string | null;
    hashrateTh: number | null;
    workerStatus: string | null;
    shares: number | null;
    estimatedProductionBtc: number | null;
    uptimeIndicator: string | null;
    payload?: unknown;
  },
): void {
  db.prepare(
    `INSERT INTO fleet_snapshots (
      id, ingested_at, miner_id, worker_name, hashrate_th, worker_status,
      shares, estimated_production_btc, uptime_indicator, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId('fs'),
    nowIso(),
    input.minerId,
    input.workerName,
    input.hashrateTh,
    input.workerStatus,
    input.shares,
    input.estimatedProductionBtc,
    input.uptimeIndicator,
    input.payload == null ? null : JSON.stringify(input.payload),
  );
}

export function insertExceptionHistory(
  db: ForgeDb,
  input: {
    kind: string;
    severity: string;
    miner: string | null;
    minerId: string | null;
    facilityId: string | null;
    reason: string;
    observedValue: string | null;
    expectedValue: string | null;
    startedAt: string;
    endedAt?: string | null;
    durationHours?: number | null;
  },
): void {
  db.prepare(
    `INSERT INTO exception_history (
      id, kind, severity, miner, miner_id, facility_id, reason,
      observed_value, expected_value, started_at, ended_at, duration_hours, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    newId('ex'),
    input.kind,
    input.severity,
    input.miner,
    input.minerId,
    input.facilityId,
    input.reason,
    input.observedValue,
    input.expectedValue,
    input.startedAt,
    input.endedAt ?? null,
    input.durationHours ?? null,
  );
}

export function listExceptionHistory(db: ForgeDb, limit = 200) {
  return db
    .prepare(
      `SELECT * FROM exception_history ORDER BY started_at DESC LIMIT ?`,
    )
    .all(limit);
}
