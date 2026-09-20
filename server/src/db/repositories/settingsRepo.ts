import type { ForgeDb } from '../client.js';
import { newId, nowIso } from '../client.js';
import {
  DEFAULT_ALLOCATION_TARGETS,
  DEFAULT_ASSUMPTIONS,
  type CapitalAllocationTarget,
  type Liability,
  type LiabilityInput,
  type OwnerAssumptions,
} from '../../domain/owner.js';
import { writeAudit } from './auditRepo.js';

type LiabilityRow = {
  id: string;
  kind: string;
  label: string;
  amount_usd: number;
  original_principal_usd: number | null;
  outstanding_principal_usd: number | null;
  rate_pct: number | null;
  payment_usd: number | null;
  maturity: string | null;
  secured_asset: string | null;
  counterparty: string;
  notes: string;
  as_of: string;
  active: number;
  created_at: string;
  updated_at: string;
};

function rowToLiability(row: LiabilityRow): Liability {
  return {
    id: row.id,
    kind: row.kind as Liability['kind'],
    label: row.label,
    amountUsd: row.amount_usd,
    originalPrincipalUsd: row.original_principal_usd,
    outstandingPrincipalUsd: row.outstanding_principal_usd,
    ratePct: row.rate_pct,
    paymentUsd: row.payment_usd,
    maturity: row.maturity,
    securedAsset: row.secured_asset,
    counterparty: row.counterparty,
    notes: row.notes,
    asOf: row.as_of,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeLiability(input: LiabilityInput, existing?: Liability): Liability {
  const ts = nowIso();
  const amount = Math.max(0, input.amountUsd);
  const outstanding =
    input.outstandingPrincipalUsd ?? existing?.outstandingPrincipalUsd ?? amount;
  if (outstanding < 0) {
    throw new Error('Liability outstanding principal cannot be negative');
  }
  return {
    id: input.id ?? existing?.id ?? newId('liab'),
    kind: input.kind,
    label: input.label.trim(),
    amountUsd: amount,
    originalPrincipalUsd:
      input.originalPrincipalUsd ?? existing?.originalPrincipalUsd ?? amount,
    outstandingPrincipalUsd: outstanding,
    ratePct: input.ratePct ?? existing?.ratePct ?? null,
    paymentUsd: input.paymentUsd ?? existing?.paymentUsd ?? null,
    maturity: input.maturity ?? existing?.maturity ?? null,
    securedAsset: input.securedAsset ?? existing?.securedAsset ?? null,
    counterparty: input.counterparty.trim(),
    notes: input.notes ?? '',
    asOf: input.asOf,
    active: input.active ?? existing?.active ?? true,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
}

export function listLiabilities(db: ForgeDb): Liability[] {
  const rows = db
    .prepare('SELECT * FROM liabilities ORDER BY created_at ASC')
    .all() as LiabilityRow[];
  return rows.map(rowToLiability);
}

export function createLiability(db: ForgeDb, input: LiabilityInput): Liability {
  if (!input.label?.trim()) throw new Error('Liability label is required');
  const row = normalizeLiability(input);
  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO liabilities (
        id, kind, label, amount_usd, original_principal_usd, outstanding_principal_usd,
        rate_pct, payment_usd, maturity, secured_asset, counterparty, notes, as_of,
        active, created_at, updated_at
      ) VALUES (
        @id, @kind, @label, @amountUsd, @originalPrincipalUsd, @outstandingPrincipalUsd,
        @ratePct, @paymentUsd, @maturity, @securedAsset, @counterparty, @notes, @asOf,
        @active, @createdAt, @updatedAt
      )`,
    ).run({
      id: row.id,
      kind: row.kind,
      label: row.label,
      amountUsd: row.amountUsd,
      originalPrincipalUsd: row.originalPrincipalUsd ?? null,
      outstandingPrincipalUsd: row.outstandingPrincipalUsd ?? null,
      ratePct: row.ratePct ?? null,
      paymentUsd: row.paymentUsd ?? null,
      maturity: row.maturity ?? null,
      securedAsset: row.securedAsset ?? null,
      counterparty: row.counterparty,
      notes: row.notes,
      asOf: row.asOf,
      active: row.active ? 1 : 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
    writeAudit(db, {
      recordType: 'liability',
      recordId: row.id,
      action: 'create',
      priorValue: null,
      newValue: row,
      source: 'api',
    });
  });
  run();
  return row;
}

export function updateLiability(
  db: ForgeDb,
  id: string,
  patch: Partial<LiabilityInput>,
): Liability {
  const existing = listLiabilities(db).find((l) => l.id === id);
  if (!existing) throw new Error(`Liability not found: ${id}`);
  const merged = normalizeLiability({ ...existing, ...patch, id }, existing);
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE liabilities SET
        kind=@kind, label=@label, amount_usd=@amountUsd,
        original_principal_usd=@originalPrincipalUsd,
        outstanding_principal_usd=@outstandingPrincipalUsd,
        rate_pct=@ratePct, payment_usd=@paymentUsd, maturity=@maturity,
        secured_asset=@securedAsset, counterparty=@counterparty, notes=@notes,
        as_of=@asOf, active=@active, updated_at=@updatedAt
       WHERE id=@id`,
    ).run({
      id,
      kind: merged.kind,
      label: merged.label,
      amountUsd: merged.amountUsd,
      originalPrincipalUsd: merged.originalPrincipalUsd ?? null,
      outstandingPrincipalUsd: merged.outstandingPrincipalUsd ?? null,
      ratePct: merged.ratePct ?? null,
      paymentUsd: merged.paymentUsd ?? null,
      maturity: merged.maturity ?? null,
      securedAsset: merged.securedAsset ?? null,
      counterparty: merged.counterparty,
      notes: merged.notes,
      asOf: merged.asOf,
      active: merged.active ? 1 : 0,
      updatedAt: merged.updatedAt,
    });
    writeAudit(db, {
      recordType: 'liability',
      recordId: id,
      action: 'update',
      priorValue: existing,
      newValue: merged,
      source: 'api',
    });
  });
  run();
  return merged;
}

export function removeLiability(db: ForgeDb, id: string): void {
  const existing = listLiabilities(db).find((l) => l.id === id);
  if (!existing) return;
  const run = db.transaction(() => {
    db.prepare('DELETE FROM liabilities WHERE id = ?').run(id);
    writeAudit(db, {
      recordType: 'liability',
      recordId: id,
      action: 'delete',
      priorValue: existing,
      newValue: null,
      source: 'api',
    });
  });
  run();
}

export function getAssumptions(db: ForgeDb): OwnerAssumptions {
  const row = db
    .prepare('SELECT * FROM owner_assumptions WHERE id = ?')
    .get('default') as
    | {
        pool_fee_pct: number;
        uptime_pct: number;
        default_electricity_rate_per_kwh: number;
        efficiency_target_j_th: number | null;
        monthly_accumulation_btc: number;
        target_btc: number;
        other_assets_usd: number;
        btc_allocation_target_pct: number | null;
        mining_allocation_target_pct: number | null;
        cash_allocation_target_pct: number | null;
        updated_at: string;
      }
    | undefined;
  if (!row) return { ...DEFAULT_ASSUMPTIONS };
  return {
    poolFeePct: row.pool_fee_pct,
    uptimePct: row.uptime_pct,
    defaultElectricityRatePerKwh: row.default_electricity_rate_per_kwh,
    efficiencyTargetJTh: row.efficiency_target_j_th,
    monthlyAccumulationBtc: row.monthly_accumulation_btc,
    targetBtc: row.target_btc,
    otherAssetsUsd: row.other_assets_usd,
    btcAllocationTargetPct: row.btc_allocation_target_pct,
    miningAllocationTargetPct: row.mining_allocation_target_pct,
    cashAllocationTargetPct: row.cash_allocation_target_pct,
    updatedAt: row.updated_at,
  };
}

export function saveAssumptions(
  db: ForgeDb,
  next: OwnerAssumptions,
): OwnerAssumptions {
  const prior = getAssumptions(db);
  const saved: OwnerAssumptions = { ...next, updatedAt: nowIso() };
  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO owner_assumptions (
        id, pool_fee_pct, uptime_pct, default_electricity_rate_per_kwh,
        efficiency_target_j_th, monthly_accumulation_btc, target_btc, other_assets_usd,
        btc_allocation_target_pct, mining_allocation_target_pct, cash_allocation_target_pct,
        updated_at
      ) VALUES (
        'default', @poolFeePct, @uptimePct, @defaultElectricityRatePerKwh,
        @efficiencyTargetJTh, @monthlyAccumulationBtc, @targetBtc, @otherAssetsUsd,
        @btcAllocationTargetPct, @miningAllocationTargetPct, @cashAllocationTargetPct,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        pool_fee_pct=excluded.pool_fee_pct,
        uptime_pct=excluded.uptime_pct,
        default_electricity_rate_per_kwh=excluded.default_electricity_rate_per_kwh,
        efficiency_target_j_th=excluded.efficiency_target_j_th,
        monthly_accumulation_btc=excluded.monthly_accumulation_btc,
        target_btc=excluded.target_btc,
        other_assets_usd=excluded.other_assets_usd,
        btc_allocation_target_pct=excluded.btc_allocation_target_pct,
        mining_allocation_target_pct=excluded.mining_allocation_target_pct,
        cash_allocation_target_pct=excluded.cash_allocation_target_pct,
        updated_at=excluded.updated_at`,
    ).run({
      poolFeePct: saved.poolFeePct,
      uptimePct: saved.uptimePct,
      defaultElectricityRatePerKwh: saved.defaultElectricityRatePerKwh,
      efficiencyTargetJTh: saved.efficiencyTargetJTh,
      monthlyAccumulationBtc: saved.monthlyAccumulationBtc,
      targetBtc: saved.targetBtc,
      otherAssetsUsd: saved.otherAssetsUsd,
      btcAllocationTargetPct: saved.btcAllocationTargetPct ?? null,
      miningAllocationTargetPct: saved.miningAllocationTargetPct ?? null,
      cashAllocationTargetPct: saved.cashAllocationTargetPct ?? null,
      updatedAt: saved.updatedAt,
    });
    writeAudit(db, {
      recordType: 'assumptions',
      recordId: 'default',
      action: 'save',
      priorValue: prior,
      newValue: saved,
      source: 'api',
    });
  });
  run();
  return saved;
}

export function getAllocationTargets(db: ForgeDb): CapitalAllocationTarget[] {
  const rows = db
    .prepare('SELECT bucket, label, target_pct FROM allocation_targets')
    .all() as Array<{ bucket: string; label: string; target_pct: number }>;
  if (!rows.length) return [...DEFAULT_ALLOCATION_TARGETS];
  return rows.map((r) => ({
    bucket: r.bucket as CapitalAllocationTarget['bucket'],
    label: r.label,
    targetPct: r.target_pct,
  }));
}

export function saveAllocationTargets(
  db: ForgeDb,
  targets: CapitalAllocationTarget[],
): CapitalAllocationTarget[] {
  const prior = getAllocationTargets(db);
  const run = db.transaction(() => {
    db.prepare('DELETE FROM allocation_targets').run();
    const insert = db.prepare(
      'INSERT INTO allocation_targets (bucket, label, target_pct) VALUES (?, ?, ?)',
    );
    for (const t of targets) {
      insert.run(t.bucket, t.label, t.targetPct);
    }
    writeAudit(db, {
      recordType: 'allocation_targets',
      recordId: 'default',
      action: 'save',
      priorValue: prior,
      newValue: targets,
      source: 'api',
    });
  });
  run();
  return targets;
}

export function getDemoMode(db: ForgeDb): boolean {
  const row = db
    .prepare('SELECT enabled FROM demo_mode WHERE id = ?')
    .get('default') as { enabled: number } | undefined;
  return Boolean(row?.enabled);
}

export function setDemoMode(db: ForgeDb, enabled: boolean): void {
  db.prepare(
    `INSERT INTO demo_mode (id, enabled, updated_at) VALUES ('default', ?, ?)
     ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled, updated_at=excluded.updated_at`,
  ).run(enabled ? 1 : 0, nowIso());
}
