import type { ForgeDb } from '../client.js';
import { newId, nowIso } from '../client.js';
import type { AuditEvent } from '../../domain/owner.js';

export function writeAudit(
  db: ForgeDb,
  input: {
    recordType: string;
    recordId: string;
    action: string;
    priorValue: unknown;
    newValue: unknown;
    source?: string;
  },
): AuditEvent {
  const event: AuditEvent = {
    id: newId('audit'),
    recordType: input.recordType,
    recordId: input.recordId,
    action: input.action,
    priorValue: input.priorValue,
    newValue: input.newValue,
    source: input.source ?? 'api',
    createdAt: nowIso(),
  };
  db.prepare(
    `INSERT INTO audit_events (
      id, record_type, record_id, action, prior_value_json, new_value_json, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.id,
    event.recordType,
    event.recordId,
    event.action,
    event.priorValue == null ? null : JSON.stringify(event.priorValue),
    event.newValue == null ? null : JSON.stringify(event.newValue),
    event.source,
    event.createdAt,
  );
  return event;
}

export function listAuditEvents(db: ForgeDb, limit = 200): AuditEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string;
    record_type: string;
    record_id: string;
    action: string;
    prior_value_json: string | null;
    new_value_json: string | null;
    source: string;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    recordType: row.record_type,
    recordId: row.record_id,
    action: row.action,
    priorValue: row.prior_value_json ? JSON.parse(row.prior_value_json) : null,
    newValue: row.new_value_json ? JSON.parse(row.new_value_json) : null,
    source: row.source,
    createdAt: row.created_at,
  }));
}
