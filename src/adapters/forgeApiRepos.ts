/**
 * API-backed owner repositories — durable server datastore via Forge API.
 * UI keeps the same repository interfaces as localStorage adapters.
 */

import type {
  CapitalAllocationTarget,
  Facility,
  Liability,
  MinerAsset,
  MinerAssetInput,
  OwnerAssumptions,
  TreasuryPosition,
  TreasuryTransaction,
} from '../domain/types';
import { resolveForgeApiUrl } from '../services/forgeApi';
import type {
  DemoModeStore,
  FacilityRepository,
  FleetRepository,
  LiabilityRepository,
  OwnerSettingsRepository,
  TreasuryLedgerRepository,
  TreasuryRepository,
} from '../services/repositories';

async function ownerFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(resolveForgeApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new Error(body.error ?? `Owner API error (${response.status})`);
  }
  return body;
}

export function createApiFleetRepository(): FleetRepository {
  return {
    async list() {
      const body = await ownerFetch<{ miners: MinerAsset[] }>('/api/owner/miners');
      return body.miners ?? [];
    },
    async get(id) {
      const all = await this.list();
      return all.find((a) => a.id === id) ?? null;
    },
    async create(input) {
      const body = await ownerFetch<{ miner: MinerAsset }>('/api/owner/miners', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return body.miner;
    },
    async update(id, patch) {
      const body = await ownerFetch<{ miner: MinerAsset }>(
        `/api/owner/miners/${encodeURIComponent(id)}`,
        { method: 'PUT', body: JSON.stringify(patch) },
      );
      return body.miner;
    },
    async remove(id) {
      await ownerFetch(`/api/owner/miners/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
    async replaceAll(assets) {
      // No bulk replace endpoint — sequential upsert by serial via import commit path.
      // Used rarely; migrate via /api/owner/migration/localStorage instead.
      for (const asset of assets) {
        await this.create(asset as MinerAssetInput);
      }
    },
  };
}

export function createApiTreasuryRepository(): TreasuryRepository {
  return {
    async get() {
      const body = await ownerFetch<{ position: TreasuryPosition }>(
        '/api/owner/treasury',
      );
      return body.position;
    },
    async save(position) {
      const body = await ownerFetch<{ position: TreasuryPosition }>(
        '/api/owner/treasury/position',
        { method: 'PUT', body: JSON.stringify(position) },
      );
      return body.position;
    },
  };
}

export function createApiTreasuryLedgerRepository(): TreasuryLedgerRepository {
  return {
    async list() {
      const body = await ownerFetch<{ transactions: TreasuryTransaction[] }>(
        '/api/owner/treasury',
      );
      return body.transactions ?? [];
    },
    async append(input) {
      const body = await ownerFetch<{ transaction: TreasuryTransaction }>(
        '/api/owner/treasury/transactions',
        { method: 'POST', body: JSON.stringify(input) },
      );
      return body.transaction;
    },
    async remove() {
      throw new Error(
        'Treasury ledger is append-only on the durable store. Record a REVERSAL or ADJUSTMENT instead of deleting.',
      );
    },
  };
}

export function createApiFacilityRepository(): FacilityRepository {
  return {
    async list() {
      const body = await ownerFetch<{ facilities: Facility[] }>(
        '/api/owner/facilities',
      );
      return body.facilities ?? [];
    },
    async create(input) {
      const body = await ownerFetch<{ facility: Facility }>(
        '/api/owner/facilities',
        { method: 'POST', body: JSON.stringify(input) },
      );
      return body.facility;
    },
    async update(id, patch) {
      const body = await ownerFetch<{ facility: Facility }>(
        `/api/owner/facilities/${encodeURIComponent(id)}`,
        { method: 'PUT', body: JSON.stringify(patch) },
      );
      return body.facility;
    },
    async remove(id) {
      await ownerFetch(`/api/owner/facilities/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  };
}

export function createApiLiabilityRepository(): LiabilityRepository {
  return {
    async list() {
      const body = await ownerFetch<{ liabilities: Liability[] }>(
        '/api/owner/liabilities',
      );
      return body.liabilities ?? [];
    },
    async create(input) {
      const body = await ownerFetch<{ liability: Liability }>(
        '/api/owner/liabilities',
        { method: 'POST', body: JSON.stringify(input) },
      );
      return body.liability;
    },
    async update(id, patch) {
      const body = await ownerFetch<{ liability: Liability }>(
        `/api/owner/liabilities/${encodeURIComponent(id)}`,
        { method: 'PUT', body: JSON.stringify(patch) },
      );
      return body.liability;
    },
    async remove(id) {
      await ownerFetch(`/api/owner/liabilities/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  };
}

export function createApiOwnerSettingsRepository(): OwnerSettingsRepository {
  return {
    async getAssumptions() {
      const body = await ownerFetch<{ assumptions: OwnerAssumptions }>(
        '/api/owner/settings',
      );
      return body.assumptions;
    },
    async saveAssumptions(next) {
      const body = await ownerFetch<{ assumptions: OwnerAssumptions }>(
        '/api/owner/settings/assumptions',
        { method: 'PUT', body: JSON.stringify(next) },
      );
      return body.assumptions;
    },
    async getAllocationTargets() {
      const body = await ownerFetch<{
        allocationTargets: CapitalAllocationTarget[];
      }>('/api/owner/settings');
      return body.allocationTargets;
    },
    async saveAllocationTargets(targets) {
      const body = await ownerFetch<{
        allocationTargets: CapitalAllocationTarget[];
      }>('/api/owner/settings/allocation', {
        method: 'PUT',
        body: JSON.stringify(targets),
      });
      return body.allocationTargets;
    },
  };
}

export function createApiDemoModeStore(): DemoModeStore {
  return {
    async isDemoMode() {
      const body = await ownerFetch<{ demoMode: boolean }>(
        '/api/owner/settings',
      );
      return Boolean(body.demoMode);
    },
    async setDemoMode(enabled) {
      await ownerFetch('/api/owner/settings/demo-mode', {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
    },
  };
}

export interface ReconciliationIssueDto {
  id: string;
  code: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  detail: string;
  recordType?: string;
  recordId?: string | null;
}

export async function fetchReconciliation(
  workers?: Array<{ name: string }>,
): Promise<ReconciliationIssueDto[]> {
  const qs =
    workers && workers.length
      ? `?workers=${encodeURIComponent(JSON.stringify(workers))}`
      : '';
  const body = await ownerFetch<{ issues: ReconciliationIssueDto[] }>(
    `/api/owner/reconciliation${qs}`,
  );
  return body.issues ?? [];
}

export async function fetchOwnerExport(): Promise<unknown> {
  const body = await ownerFetch<{ backup: unknown }>('/api/owner/export');
  return body.backup;
}

export async function fetchBraiinsConnectionStatus(): Promise<{
  braiins: {
    configured: boolean;
    authenticated: boolean | null;
    lastSuccessfulSync: string | null;
    workerCount: number | null;
    matchedWorkers: number | null;
    unmatchedWorkers: number | null;
    staleWorkers: number | null;
    lastError: string | null;
    providerErrors: string[];
  };
  accounting: {
    provider: string;
    status: string;
    connected: boolean;
    note: string;
  };
}> {
  return ownerFetch('/api/owner/connections/braiins');
}

export async function reportBraiinsSyncState(state: {
  lastSuccessAt: string | null;
  lastError: string | null;
  workerCount: number | null;
  matchedWorkers: number | null;
  unmatchedWorkers: number | null;
  staleWorkers: number | null;
}): Promise<void> {
  await ownerFetch('/api/owner/connections/braiins/sync-state', {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export async function previewMinerImport(csv: string): Promise<{
  rows: Array<{
    rowNumber: number;
    action: string;
    errors: string[];
    serialNumber: string;
  }>;
  inserts: number;
  updates: number;
  rejected: number;
}> {
  return ownerFetch('/api/owner/import/miners/preview', {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });
}

export async function commitMinerImport(csv: string): Promise<{
  inserted: number;
  updated: number;
  rejected: number;
}> {
  return ownerFetch('/api/owner/import/miners/commit', {
    method: 'POST',
    body: JSON.stringify({ csv, confirm: true }),
  });
}

export async function importAccountingCsv(
  csv: string,
  filename?: string,
): Promise<{ rowCount: number; provenance: string; accountingProvider: string }> {
  return ownerFetch('/api/owner/import/accounting', {
    method: 'POST',
    body: JSON.stringify({ csv, filename }),
  });
}

export async function fetchMigrationStatus(): Promise<{
  status: string;
  importedAt: string | null;
  fingerprint: string | null;
  notes: string;
}> {
  const body = await ownerFetch<{
    migration: {
      status: string;
      importedAt: string | null;
      fingerprint: string | null;
      notes: string;
    };
  }>('/api/owner/migration/status');
  return body.migration;
}

export async function migrateLegacyLocalStorage(
  payload: unknown,
  force = false,
): Promise<{ imported: Record<string, number> }> {
  return ownerFetch('/api/owner/migration/localStorage', {
    method: 'POST',
    body: JSON.stringify({ payload, force }),
  });
}

export async function triggerSnapshotJob(
  kind: 'market' | 'network' | 'all' = 'all',
): Promise<unknown> {
  return ownerFetch(`/api/owner/jobs/snapshots?kind=${kind}`, {
    method: 'POST',
    body: JSON.stringify({ kind }),
  });
}

export async function fetchHistoricalNav(asOf?: string): Promise<unknown> {
  const qs = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
  const body = await ownerFetch<{ nav: unknown }>(`/api/owner/history/nav${qs}`);
  return body.nav;
}
