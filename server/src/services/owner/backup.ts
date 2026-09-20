import type { ForgeDb } from '../../db/client.js';
import { fingerprintPayload, nowIso } from '../../db/client.js';
import type {
  LegacyMigrationStatus,
  OwnerLedgerBackup,
  TreasuryTransaction,
} from '../../domain/owner.js';
import {
  createFacility,
  createMiner,
  listFacilities,
  listMiners,
  replaceAllMiners,
} from '../../db/repositories/assetRepo.js';
import {
  appendTreasuryTransaction,
  getTreasuryPosition,
  listTreasuryTransactions,
  saveTreasuryPosition,
} from '../../db/repositories/treasuryRepo.js';
import {
  createLiability,
  getAllocationTargets,
  getAssumptions,
  listLiabilities,
  saveAllocationTargets,
  saveAssumptions,
} from '../../db/repositories/settingsRepo.js';
import { listProductionDaily } from '../../db/repositories/snapshotRepo.js';
import { writeAudit } from '../../db/repositories/auditRepo.js';

export function getMigrationStatus(db: ForgeDb): LegacyMigrationStatus {
  const row = db
    .prepare('SELECT * FROM migration_status WHERE id = ?')
    .get('legacy_localStorage') as
    | {
        status: string;
        imported_at: string | null;
        fingerprint: string | null;
        notes: string;
        updated_at: string;
      }
    | undefined;
  if (!row) {
    return {
      status: 'pending',
      importedAt: null,
      fingerprint: null,
      notes: '',
      updatedAt: new Date(0).toISOString(),
    };
  }
  return {
    status: row.status as LegacyMigrationStatus['status'],
    importedAt: row.imported_at,
    fingerprint: row.fingerprint,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

function setMigrationStatus(
  db: ForgeDb,
  status: LegacyMigrationStatus['status'],
  fingerprint: string | null,
  notes: string,
): LegacyMigrationStatus {
  const updatedAt = nowIso();
  const importedAt = status === 'imported' ? updatedAt : null;
  db.prepare(
    `INSERT INTO migration_status (id, status, imported_at, fingerprint, notes, updated_at)
     VALUES ('legacy_localStorage', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status=excluded.status,
       imported_at=COALESCE(excluded.imported_at, migration_status.imported_at),
       fingerprint=excluded.fingerprint,
       notes=excluded.notes,
       updated_at=excluded.updated_at`,
  ).run(status, importedAt, fingerprint, notes, updatedAt);
  return getMigrationStatus(db);
}

export interface LegacyBrowserPayload {
  miners?: unknown;
  facilities?: unknown;
  treasury?: unknown;
  transactions?: unknown;
  liabilities?: unknown;
  assumptions?: unknown;
  allocationTargets?: unknown;
}

export function importLegacyBrowserLedger(
  db: ForgeDb,
  payload: LegacyBrowserPayload,
  opts: { force?: boolean } = {},
): {
  status: LegacyMigrationStatus;
  imported: {
    miners: number;
    facilities: number;
    transactions: number;
    liabilities: number;
  };
} {
  const current = getMigrationStatus(db);
  const fp = fingerprintPayload(payload);

  if (current.status === 'imported' && current.fingerprint === fp && !opts.force) {
    throw new Error(
      'This legacy localStorage payload was already imported (duplicate fingerprint). Pass force=true to re-import explicitly.',
    );
  }

  const minersCount = listMiners(db).length;
  const facCount = listFacilities(db).length;
  const txCount = listTreasuryTransactions(db).length;
  if ((minersCount > 0 || facCount > 0 || txCount > 0) && !opts.force) {
    throw new Error(
      'Server-side owner data already exists. Refusing to overwrite. Export a backup first, then re-import with force=true if intentional.',
    );
  }

  const imported = { miners: 0, facilities: 0, transactions: 0, liabilities: 0 };

  const run = db.transaction(() => {
    if (Array.isArray(payload.facilities)) {
      for (const f of payload.facilities) {
        createFacility(db, f as Parameters<typeof createFacility>[1]);
        imported.facilities += 1;
      }
    }
    if (Array.isArray(payload.miners)) {
      for (const m of payload.miners) {
        createMiner(db, m as Parameters<typeof createMiner>[1]);
        imported.miners += 1;
      }
    }
    if (payload.treasury && typeof payload.treasury === 'object') {
      saveTreasuryPosition(db, {
        ...getTreasuryPosition(db),
        ...(payload.treasury as object),
      } as ReturnType<typeof getTreasuryPosition>);
    }
    if (Array.isArray(payload.transactions)) {
      for (const tx of payload.transactions) {
        appendTreasuryTransaction(
          db,
          tx as TreasuryTransaction,
        );
        imported.transactions += 1;
      }
    }
    if (Array.isArray(payload.liabilities)) {
      for (const l of payload.liabilities) {
        createLiability(db, l as Parameters<typeof createLiability>[1]);
        imported.liabilities += 1;
      }
    }
    if (payload.assumptions && typeof payload.assumptions === 'object') {
      saveAssumptions(db, {
        ...getAssumptions(db),
        ...(payload.assumptions as object),
      } as ReturnType<typeof getAssumptions>);
    }
    if (Array.isArray(payload.allocationTargets)) {
      saveAllocationTargets(
        db,
        payload.allocationTargets as Parameters<typeof saveAllocationTargets>[1],
      );
    }
    writeAudit(db, {
      recordType: 'migration',
      recordId: 'legacy_localStorage',
      action: 'import',
      priorValue: current,
      newValue: imported,
      source: 'migration',
    });
    setMigrationStatus(db, 'imported', fp, 'Imported from browser localStorage');
  });
  run();

  return { status: getMigrationStatus(db), imported };
}

export function exportOwnerBackup(db: ForgeDb): OwnerLedgerBackup {
  return {
    version: 1,
    exportedAt: nowIso(),
    miners: listMiners(db),
    facilities: listFacilities(db),
    treasury: getTreasuryPosition(db),
    transactions: listTreasuryTransactions(db),
    liabilities: listLiabilities(db),
    assumptions: getAssumptions(db),
    allocationTargets: getAllocationTargets(db),
    productionDaily: listProductionDaily(db),
  };
}

export function restoreOwnerBackup(
  db: ForgeDb,
  backup: OwnerLedgerBackup,
  opts: { replace?: boolean } = {},
): void {
  if (backup.version !== 1) {
    throw new Error('Unsupported backup version');
  }
  if (!opts.replace) {
    throw new Error('Restore requires replace=true confirmation');
  }
  const run = db.transaction(() => {
    replaceAllMiners(db, []);
    db.prepare('DELETE FROM facilities').run();
    db.prepare('DELETE FROM treasury_transactions').run();
    db.prepare('DELETE FROM liabilities').run();

    for (const f of backup.facilities) {
      createFacility(db, f);
    }
    replaceAllMiners(db, backup.miners);
    saveTreasuryPosition(db, backup.treasury);
    for (const tx of backup.transactions) {
      appendTreasuryTransaction(db, tx);
    }
    for (const l of backup.liabilities) {
      createLiability(db, l);
    }
    saveAssumptions(db, backup.assumptions);
    saveAllocationTargets(db, backup.allocationTargets);
    writeAudit(db, {
      recordType: 'backup',
      recordId: 'restore',
      action: 'restore',
      priorValue: null,
      newValue: { exportedAt: backup.exportedAt },
      source: 'backup',
    });
  });
  run();
}
