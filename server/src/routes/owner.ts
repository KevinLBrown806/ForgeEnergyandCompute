import { Router } from 'express';
import { getDb } from '../db/client.js';
import {
  createFacility,
  createMiner,
  listFacilities,
  listMiners,
  removeFacility,
  removeMiner,
  updateFacility,
  updateMiner,
} from '../db/repositories/assetRepo.js';
import { listAuditEvents } from '../db/repositories/auditRepo.js';
import { runReconciliation } from '../db/repositories/reconciliation.js';
import {
  insertExceptionHistory,
  listExceptionHistory,
  listMarketSnapshots,
  listNetworkSnapshots,
  listProductionDaily,
  upsertProductionDaily,
} from '../db/repositories/snapshotRepo.js';
import {
  createLiability,
  getAllocationTargets,
  getAssumptions,
  getDemoMode,
  listLiabilities,
  removeLiability,
  saveAllocationTargets,
  saveAssumptions,
  setDemoMode,
  updateLiability,
} from '../db/repositories/settingsRepo.js';
import {
  appendTreasuryTransaction,
  getTreasuryPosition,
  listTreasuryTransactions,
  refuseTreasuryDelete,
  saveTreasuryPosition,
} from '../db/repositories/treasuryRepo.js';
import {
  ACCOUNTING_CSV_TEMPLATE_HEADERS,
  FACILITY_CSV_TEMPLATE_HEADERS,
  MINER_CSV_TEMPLATE_HEADERS,
  parseAccountingCsv,
  previewFacilityCsv,
  previewMinerCsv,
  toCsv,
} from '../domain/csvImport.js';
import { computeHistoricalNav } from '../domain/historicalNav.js';
import {
  evaluateFreshness,
  FRESHNESS_THRESHOLDS,
} from '../domain/freshness.js';
import type {
  BraiinsConnectionStatus,
  FacilityInput,
  LiabilityInput,
  MinerAssetInput,
  OwnerAssumptions,
  TreasuryPosition,
  TreasuryTransactionInput,
} from '../domain/owner.js';
import { getEnv } from '../config/env.js';
import { requireOwnerAuth } from '../middleware/auth.js';
import { safeErrorMessage } from '../middleware/security.js';
import { runSnapshotJob } from '../jobs/snapshots.js';
import {
  exportOwnerBackup,
  getMigrationStatus,
  importLegacyBrowserLedger,
  restoreOwnerBackup,
} from '../services/owner/backup.js';
import { newId, nowIso } from '../db/client.js';
import { writeAudit } from '../db/repositories/auditRepo.js';

export const ownerRouter = Router();
ownerRouter.use(requireOwnerAuth);

function db() {
  return getDb();
}

function handleError(res: import('express').Response, err: unknown, status = 400) {
  res.status(status).json({ ok: false, error: safeErrorMessage(err) });
}

// —— Miners ——
ownerRouter.get('/miners', (_req, res) => {
  res.json({ ok: true, miners: listMiners(db()) });
});

ownerRouter.post('/miners', (req, res) => {
  try {
    const miner = createMiner(db(), req.body as MinerAssetInput);
    res.status(201).json({ ok: true, miner });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.put('/miners/:id', (req, res) => {
  try {
    const miner = updateMiner(db(), req.params.id, req.body as Partial<MinerAssetInput>);
    res.json({ ok: true, miner });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.delete('/miners/:id', (req, res) => {
  try {
    removeMiner(db(), req.params.id);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// —— Facilities ——
ownerRouter.get('/facilities', (_req, res) => {
  res.json({ ok: true, facilities: listFacilities(db()) });
});

ownerRouter.post('/facilities', (req, res) => {
  try {
    const facility = createFacility(db(), req.body as FacilityInput);
    res.status(201).json({ ok: true, facility });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.put('/facilities/:id', (req, res) => {
  try {
    const facility = updateFacility(
      db(),
      req.params.id,
      req.body as Partial<FacilityInput>,
    );
    res.json({ ok: true, facility });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.delete('/facilities/:id', (req, res) => {
  try {
    removeFacility(db(), req.params.id);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// —— Treasury ——
ownerRouter.get('/treasury', (_req, res) => {
  res.json({
    ok: true,
    position: getTreasuryPosition(db()),
    transactions: listTreasuryTransactions(db()),
  });
});

ownerRouter.put('/treasury/position', (req, res) => {
  try {
    const position = saveTreasuryPosition(db(), req.body as TreasuryPosition);
    res.json({ ok: true, position });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.post('/treasury/transactions', (req, res) => {
  try {
    const tx = appendTreasuryTransaction(
      db(),
      req.body as TreasuryTransactionInput,
    );
    res.status(201).json({ ok: true, transaction: tx });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.delete('/treasury/transactions/:id', (_req, res) => {
  try {
    refuseTreasuryDelete();
  } catch (err) {
    handleError(res, err, 405);
  }
});

// —— Liabilities ——
ownerRouter.get('/liabilities', (_req, res) => {
  res.json({ ok: true, liabilities: listLiabilities(db()) });
});

ownerRouter.post('/liabilities', (req, res) => {
  try {
    const liability = createLiability(db(), req.body as LiabilityInput);
    res.status(201).json({ ok: true, liability });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.put('/liabilities/:id', (req, res) => {
  try {
    const liability = updateLiability(
      db(),
      req.params.id,
      req.body as Partial<LiabilityInput>,
    );
    res.json({ ok: true, liability });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.delete('/liabilities/:id', (req, res) => {
  try {
    removeLiability(db(), req.params.id);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// —— Settings ——
ownerRouter.get('/settings', (_req, res) => {
  res.json({
    ok: true,
    assumptions: getAssumptions(db()),
    allocationTargets: getAllocationTargets(db()),
    demoMode: getDemoMode(db()),
  });
});

ownerRouter.put('/settings/assumptions', (req, res) => {
  try {
    const assumptions = saveAssumptions(db(), req.body as OwnerAssumptions);
    res.json({ ok: true, assumptions });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.put('/settings/allocation', (req, res) => {
  try {
    const allocationTargets = saveAllocationTargets(
      db(),
      req.body as Parameters<typeof saveAllocationTargets>[1],
    );
    res.json({ ok: true, allocationTargets });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.put('/settings/demo-mode', (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  setDemoMode(db(), enabled);
  res.json({ ok: true, demoMode: enabled });
});

// —— Import / templates ——
ownerRouter.get('/import/templates/miners.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="forge-miners-template.csv"',
  );
  res.send(toCsv([...MINER_CSV_TEMPLATE_HEADERS], []));
});

ownerRouter.get('/import/templates/facilities.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="forge-facilities-template.csv"',
  );
  res.send(toCsv([...FACILITY_CSV_TEMPLATE_HEADERS], []));
});

ownerRouter.get('/import/templates/accounting.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="forge-accounting-template.csv"',
  );
  res.send(toCsv([...ACCOUNTING_CSV_TEMPLATE_HEADERS], []));
});

ownerRouter.post('/import/miners/preview', (req, res) => {
  try {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (!csv) throw new Error('csv string is required');
    const preview = previewMinerCsv(
      csv,
      listMiners(db()).map((m) => ({ id: m.id, serialNumber: m.serialNumber })),
    );
    res.json({ ok: true, ...preview });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.post('/import/miners/commit', (req, res) => {
  try {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    const confirm = Boolean(req.body?.confirm);
    if (!confirm) throw new Error('confirm=true is required to commit import');
    const preview = previewMinerCsv(
      csv,
      listMiners(db()).map((m) => ({ id: m.id, serialNumber: m.serialNumber })),
    );
    const database = db();
    let inserted = 0;
    let updated = 0;
    const run = database.transaction(() => {
      for (const row of preview.rows) {
        if (row.action === 'reject' || !row.payload) continue;
        if (row.action === 'update' && row.existingId) {
          updateMiner(database, row.existingId, row.payload);
          updated += 1;
        } else {
          createMiner(database, row.payload);
          inserted += 1;
        }
      }
    });
    run();
    res.json({ ok: true, inserted, updated, rejected: preview.rejected });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.post('/import/facilities/preview', (req, res) => {
  try {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    res.json({ ok: true, ...previewFacilityCsv(csv) });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.post('/import/facilities/commit', (req, res) => {
  try {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (!req.body?.confirm) throw new Error('confirm=true is required');
    const preview = previewFacilityCsv(csv);
    let inserted = 0;
    const database = db();
    const run = database.transaction(() => {
      for (const row of preview.rows) {
        if (row.action === 'reject' || !row.payload) continue;
        createFacility(database, row.payload);
        inserted += 1;
      }
    });
    run();
    res.json({ ok: true, inserted });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.post('/import/accounting', (req, res) => {
  try {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    const parsed = parseAccountingCsv(csv);
    if (parsed.errors.length) {
      res.status(400).json({ ok: false, errors: parsed.errors });
      return;
    }
    // Manual / IMPORTED provenance — never LIVE. Found remains NOT CONNECTED.
    const database = db();
    database
      .prepare(
        `INSERT INTO accounting_imports (id, imported_at, filename, row_count, provenance, notes, payload_json)
         VALUES (?, ?, ?, ?, 'MANUAL', ?, ?)`,
      )
      .run(
        newId('acct'),
        nowIso(),
        typeof req.body?.filename === 'string' ? req.body.filename : null,
        parsed.rows.length,
        'Found Accounting — NOT CONNECTED; manual CSV import',
        JSON.stringify(parsed.rows),
      );
    writeAudit(database, {
      recordType: 'accounting_import',
      recordId: 'manual',
      action: 'import',
      priorValue: null,
      newValue: { rowCount: parsed.rows.length, provenance: 'MANUAL' },
      source: 'import',
    });
    res.json({
      ok: true,
      rowCount: parsed.rows.length,
      provenance: 'MANUAL',
      accountingProvider: 'Found Accounting — NOT CONNECTED',
    });
  } catch (err) {
    handleError(res, err);
  }
});

// —— Export / backup ——
ownerRouter.get('/export', (_req, res) => {
  const backup = exportOwnerBackup(db());
  res.json({ ok: true, backup });
});

ownerRouter.get('/export/miners.csv', (_req, res) => {
  const miners = listMiners(db());
  const csv = toCsv(
    [...MINER_CSV_TEMPLATE_HEADERS],
    miners.map((m) => [
      m.manufacturer,
      m.model,
      m.serialNumber,
      m.nominalHashrateTh,
      m.wattage,
      m.acquisitionCostUsd,
      m.shippingCostUsd ?? null,
      m.deploymentCostUsd ?? null,
      m.acquisitionDate,
      m.deploymentDate ?? null,
      m.hostingProvider,
      m.facility,
      m.electricityRatePerKwh,
      m.monthlyHostingFeeUsd,
      m.braiinsWorkerName,
      m.status,
      m.notes,
    ]),
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="forge-miners.csv"');
  res.send(csv);
});

ownerRouter.post('/backup/restore', (req, res) => {
  try {
    restoreOwnerBackup(db(), req.body?.backup, {
      replace: Boolean(req.body?.replace),
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// —— Migration ——
ownerRouter.get('/migration/status', (_req, res) => {
  res.json({ ok: true, migration: getMigrationStatus(db()) });
});

ownerRouter.post('/migration/localStorage', (req, res) => {
  try {
    const result = importLegacyBrowserLedger(db(), req.body?.payload ?? {}, {
      force: Boolean(req.body?.force),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

// —— Reconciliation ——
ownerRouter.get('/reconciliation', (req, res) => {
  const workersRaw = req.query.workers;
  let braiinsWorkers: Array<{ name: string }> | undefined;
  if (typeof workersRaw === 'string' && workersRaw) {
    try {
      braiinsWorkers = JSON.parse(workersRaw) as Array<{ name: string }>;
    } catch {
      braiinsWorkers = undefined;
    }
  }
  const issues = runReconciliation({
    miners: listMiners(db()),
    facilities: listFacilities(db()),
    transactions: listTreasuryTransactions(db()),
    treasury: getTreasuryPosition(db()),
    liabilities: listLiabilities(db()),
    braiinsWorkers,
  });
  res.json({ ok: true, issues });
});

// —— Audit ——
ownerRouter.get('/audit', (req, res) => {
  const limit = Number(req.query.limit ?? 200);
  res.json({ ok: true, events: listAuditEvents(db(), limit) });
});

// —— History ——
ownerRouter.get('/history/market', (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  const snapshots = listMarketSnapshots(db(), limit);
  const lastOk = snapshots.find((s) => s.success);
  res.json({
    ok: true,
    snapshots,
    freshness: evaluateFreshness(
      lastOk?.ingestedAt,
      FRESHNESS_THRESHOLDS.market,
      { unavailable: !lastOk },
    ),
  });
});

ownerRouter.get('/history/network', (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  const snapshots = listNetworkSnapshots(db(), limit);
  const lastOk = snapshots.find((s) => s.success);
  res.json({
    ok: true,
    snapshots,
    freshness: evaluateFreshness(
      lastOk?.ingestedAt,
      FRESHNESS_THRESHOLDS.network,
      { unavailable: !lastOk },
    ),
  });
});

ownerRouter.get('/history/nav', (req, res) => {
  const asOf =
    typeof req.query.asOf === 'string' ? req.query.asOf : new Date().toISOString();
  res.json({ ok: true, nav: computeHistoricalNav(db(), asOf) });
});

ownerRouter.get('/history/production', (_req, res) => {
  res.json({ ok: true, days: listProductionDaily(db()) });
});

ownerRouter.post('/history/production', (req, res) => {
  try {
    const day = upsertProductionDaily(db(), {
      date: req.body.date,
      btcProduced: Number(req.body.btcProduced ?? 0),
      poolSource: String(req.body.poolSource ?? ''),
      averageHashrateTh: req.body.averageHashrateTh ?? null,
      uptimePct: req.body.uptimePct ?? null,
      miningRevenueUsd: req.body.miningRevenueUsd ?? null,
      powerHostingCostUsd: req.body.powerHostingCostUsd ?? null,
      operatingProfitUsd: req.body.operatingProfitUsd ?? null,
      provenance: req.body.provenance ?? 'MANUAL',
      notes: req.body.notes ?? '',
    });
    res.status(201).json({ ok: true, day });
  } catch (err) {
    handleError(res, err);
  }
});

ownerRouter.get('/history/exceptions', (req, res) => {
  const limit = Number(req.query.limit ?? 200);
  res.json({ ok: true, exceptions: listExceptionHistory(db(), limit) });
});

ownerRouter.post('/history/exceptions', (req, res) => {
  try {
    insertExceptionHistory(db(), {
      kind: String(req.body.kind ?? ''),
      severity: String(req.body.severity ?? 'warning'),
      miner: req.body.miner ?? null,
      minerId: req.body.minerId ?? null,
      facilityId: req.body.facilityId ?? null,
      reason: String(req.body.reason ?? ''),
      observedValue: req.body.observedValue ?? null,
      expectedValue: req.body.expectedValue ?? null,
      startedAt: req.body.startedAt ?? nowIso(),
      endedAt: req.body.endedAt ?? null,
      durationHours: req.body.durationHours ?? null,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// —— Connections (Braiins status — token never returned) ——
ownerRouter.get('/connections/braiins', (req, res) => {
  const env = getEnv();
  const row = db()
    .prepare('SELECT * FROM braiins_sync_state WHERE id = ?')
    .get('default') as
    | {
        last_success_at: string | null;
        last_error: string | null;
        worker_count: number | null;
        matched_workers: number | null;
        unmatched_workers: number | null;
        stale_workers: number | null;
      }
    | undefined;

  const status: BraiinsConnectionStatus = {
    configured: env.braiinsConfigured,
    authenticated: env.authConfigured
      ? (req as { forgeAuthenticated?: boolean }).forgeAuthenticated ?? null
      : null,
    lastSuccessfulSync: row?.last_success_at ?? null,
    workerCount: row?.worker_count ?? null,
    matchedWorkers: row?.matched_workers ?? null,
    unmatchedWorkers: row?.unmatched_workers ?? null,
    staleWorkers: row?.stale_workers ?? null,
    lastError: row?.last_error ?? null,
    providerErrors: row?.last_error ? [row.last_error] : [],
  };
  res.json({
    ok: true,
    braiins: status,
    accounting: {
      provider: 'Found',
      status: 'NOT CONNECTED',
      connected: false,
      note: 'Manual CSV import only. Found has no supported API connection in Forge OS.',
    },
  });
});

ownerRouter.put('/connections/braiins/sync-state', (req, res) => {
  // Operator-reported sync metrics after a client-side Braiins poll — never accepts tokens.
  const database = db();
  database
    .prepare(
      `INSERT INTO braiins_sync_state (
        id, last_success_at, last_error, worker_count, matched_workers,
        unmatched_workers, stale_workers, updated_at
      ) VALUES (
        'default', @lastSuccessAt, @lastError, @workerCount, @matchedWorkers,
        @unmatchedWorkers, @staleWorkers, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        last_success_at=excluded.last_success_at,
        last_error=excluded.last_error,
        worker_count=excluded.worker_count,
        matched_workers=excluded.matched_workers,
        unmatched_workers=excluded.unmatched_workers,
        stale_workers=excluded.stale_workers,
        updated_at=excluded.updated_at`,
    )
    .run({
      lastSuccessAt: req.body.lastSuccessAt ?? null,
      lastError: req.body.lastError ?? null,
      workerCount: req.body.workerCount ?? null,
      matchedWorkers: req.body.matchedWorkers ?? null,
      unmatchedWorkers: req.body.unmatchedWorkers ?? null,
      staleWorkers: req.body.staleWorkers ?? null,
      updatedAt: nowIso(),
    });
  res.json({ ok: true });
});

// —— Jobs (manual / cron trigger) ——
ownerRouter.post('/jobs/snapshots', async (req, res) => {
  try {
    const kind =
      (typeof req.query.kind === 'string' ? req.query.kind : req.body?.kind) ??
      'all';
    if (kind !== 'market' && kind !== 'network' && kind !== 'all') {
      res.status(400).json({ ok: false, error: 'kind must be market|network|all' });
      return;
    }
    const result = await runSnapshotJob(db(), kind);
    res.json({ ok: true, result });
  } catch (err) {
    handleError(res, err, 502);
  }
});
