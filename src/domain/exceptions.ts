/**
 * Fleet operations exception model.
 * Owner summary stays first — these are compact exceptions, not a NOC wall.
 */

import type { FleetException, FleetRow, PoolWorker } from './types';
import { HASHRATE_DEGRADED_THRESHOLD, STALE_SHARE_MS, isProductionEligible } from './fleet';
import { efficiencyJTh } from './fleet';

export function buildFleetExceptions(args: {
  rows: FleetRow[];
  workers: PoolWorker[];
  efficiencyTargetJTh?: number | null;
  nowMs?: number;
}): FleetException[] {
  const now = args.nowMs ?? Date.now();
  const timestamp = new Date(now).toISOString();
  const exceptions: FleetException[] = [];
  const mappedNames = args.rows
    .map((r) => r.asset.braiinsWorkerName)
    .filter((n): n is string => Boolean(n));

  for (const row of args.rows) {
    const miner = `${row.asset.manufacturer ? `${row.asset.manufacturer} ` : ''}${row.asset.model}`.trim();
    const eligible = isProductionEligible(row.asset);

    if (eligible && row.health === 'OFFLINE') {
      exceptions.push({
        id: `ex-off-${row.asset.id}`,
        kind: 'MINER_OFFLINE',
        severity: 'critical',
        miner,
        minerId: row.asset.id,
        reason: 'Miner is offline or has not submitted a recent share',
        observedValue: row.workerState ?? row.health,
        expectedValue: 'ONLINE',
        timestamp,
      });
    }

    if (eligible && row.health === 'DEGRADED') {
      const observed =
        row.live5mTh != null ? `${row.live5mTh.toFixed(0)} TH/s` : row.health;
      exceptions.push({
        id: `ex-low-${row.asset.id}`,
        kind: 'HASHRATE_LOW',
        severity: 'warning',
        miner,
        minerId: row.asset.id,
        reason: `Live hashrate is below ${(HASHRATE_DEGRADED_THRESHOLD * 100).toFixed(0)}% of expected`,
        observedValue: observed,
        expectedValue: `${row.expectedHashrateTh.toFixed(0)} TH/s`,
        timestamp,
      });
    }

    if (eligible && row.health === 'UNMAPPED') {
      exceptions.push({
        id: `ex-unmap-${row.asset.id}`,
        kind: 'WORKER_UNMATCHED',
        severity: row.asset.braiinsWorkerName ? 'warning' : 'info',
        miner,
        minerId: row.asset.id,
        reason: row.asset.braiinsWorkerName
          ? `No Braiins worker matches "${row.asset.braiinsWorkerName}"`
          : 'Forge miner has no Braiins worker mapping',
        observedValue: row.asset.braiinsWorkerName ?? 'unmapped',
        expectedValue: 'matched worker',
        timestamp,
      });
    }

    if (eligible && (row.health === 'NO_DATA' || !row.lastShareAt)) {
      if (row.health === 'NO_DATA') {
        exceptions.push({
          id: `ex-nodata-${row.asset.id}`,
          kind: 'NO_RECENT_DATA',
          severity: 'warning',
          miner,
          minerId: row.asset.id,
          reason: 'No recent pool telemetry for this miner',
          observedValue: row.lastShareAt ?? 'none',
          expectedValue: 'share within 30 minutes',
          timestamp,
        });
      }
    } else if (eligible && row.lastShareAt) {
      const last = Date.parse(row.lastShareAt);
      if (Number.isFinite(last) && now - last > STALE_SHARE_MS && row.health !== 'OFFLINE') {
        exceptions.push({
          id: `ex-stale-${row.asset.id}`,
          kind: 'NO_RECENT_DATA',
          severity: 'warning',
          miner,
          minerId: row.asset.id,
          reason: 'Last share is older than 30 minutes',
          observedValue: row.lastShareAt,
          expectedValue: 'share within 30 minutes',
          timestamp,
        });
      }
    }

    const target = args.efficiencyTargetJTh;
    if (target != null && target > 0 && eligible) {
      const actual = efficiencyJTh(row.asset);
      if (actual > target) {
        exceptions.push({
          id: `ex-eff-${row.asset.id}`,
          kind: 'EFFICIENCY_BELOW_TARGET',
          severity: 'info',
          miner,
          minerId: row.asset.id,
          reason: 'Datasheet efficiency is worse than the owner target',
          observedValue: `${actual.toFixed(1)} J/TH`,
          expectedValue: `≤ ${target.toFixed(1)} J/TH`,
          timestamp,
        });
      }
    }
  }

  if (args.workers.length) {
    for (const worker of args.workers) {
      const matched = mappedNames.some((n) => {
        const a = n.trim().toLowerCase();
        const b = worker.name.trim().toLowerCase();
        if (a === b) return true;
        const aTail = a.includes('.') ? a.slice(a.lastIndexOf('.') + 1) : a;
        const bTail = b.includes('.') ? b.slice(b.lastIndexOf('.') + 1) : b;
        return aTail.length > 0 && aTail === bTail;
      });
      if (!matched) {
        exceptions.push({
          id: `ex-orphan-${worker.name.toLowerCase()}`,
          kind: 'WORKER_UNMATCHED',
          severity: 'info',
          miner: null,
          minerId: null,
          reason: `Braiins worker "${worker.name}" has no registered Forge miner`,
          observedValue: worker.name,
          expectedValue: 'registered miner',
          timestamp,
        });
      }
    }
  }

  const rank = { critical: 0, warning: 1, info: 2 };
  return exceptions.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
