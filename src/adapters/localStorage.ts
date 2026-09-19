import type { MinerAsset, MinerAssetInput, TreasuryPosition } from '../domain/types';
import { validateMappedMinerQuantity } from '../domain/fleet';
import type {
  DemoModeStore,
  FleetRepository,
  TreasuryRepository,
} from '../services/repositories';

const FLEET_KEY = 'forge.fleet.v1';
const TREASURY_KEY = 'forge.treasury.v1';
const DEMO_KEY = 'forge.demoMode.v1';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeAsset(input: MinerAssetInput, existing?: MinerAsset): MinerAsset {
  const ts = nowIso();
  validateMappedMinerQuantity({
    quantity: Math.max(1, Math.floor(input.quantity)),
    braiinsWorkerName: input.braiinsWorkerName,
  });
  return {
    id: input.id ?? existing?.id ?? newId(),
    manufacturer: (input.manufacturer ?? existing?.manufacturer ?? '').trim(),
    model: input.model.trim(),
    serialNumber: input.serialNumber.trim(),
    serialNumbers: input.serialNumbers ?? existing?.serialNumbers,
    quantity: Math.max(1, Math.floor(input.quantity)),
    nominalHashrateTh: Math.max(0, input.nominalHashrateTh),
    wattage: Math.max(0, input.wattage),
    efficiencyJTh:
      input.efficiencyJTh === undefined
        ? (existing?.efficiencyJTh ?? null)
        : input.efficiencyJTh,
    acquisitionDate: input.acquisitionDate || null,
    acquisitionCostUsd: input.acquisitionCostUsd,
    hostingProvider: input.hostingProvider.trim(),
    facility: input.facility.trim(),
    electricityRatePerKwh: input.electricityRatePerKwh,
    monthlyHostingFeeUsd: input.monthlyHostingFeeUsd,
    pool: input.pool.trim() || 'Braiins Pool',
    braiinsWorkerName: input.braiinsWorkerName?.trim() || null,
    status: input.status,
    enabled: input.enabled,
    warrantyExpiration: input.warrantyExpiration || null,
    notes: input.notes ?? '',
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
}

export function createLocalFleetRepository(): FleetRepository {
  return {
    async list() {
      return readJson<MinerAsset[]>(FLEET_KEY, []);
    },
    async get(id) {
      const all = readJson<MinerAsset[]>(FLEET_KEY, []);
      return all.find((a) => a.id === id) ?? null;
    },
    async create(input) {
      const all = readJson<MinerAsset[]>(FLEET_KEY, []);
      const asset = normalizeAsset(input);
      all.push(asset);
      writeJson(FLEET_KEY, all);
      return asset;
    },
    async update(id, patch) {
      const all = readJson<MinerAsset[]>(FLEET_KEY, []);
      const idx = all.findIndex((a) => a.id === id);
      if (idx < 0) throw new Error(`Miner asset not found: ${id}`);
      const merged = normalizeAsset({ ...all[idx], ...patch, id }, all[idx]);
      all[idx] = merged;
      writeJson(FLEET_KEY, all);
      return merged;
    },
    async remove(id) {
      const all = readJson<MinerAsset[]>(FLEET_KEY, []);
      writeJson(
        FLEET_KEY,
        all.filter((a) => a.id !== id),
      );
    },
    async replaceAll(assets) {
      writeJson(FLEET_KEY, assets);
    },
  };
}

const DEFAULT_TREASURY: TreasuryPosition = {
  btcHoldings: 0,
  avgAcquisitionPriceUsd: 0,
  btcMined: 0,
  btcPurchased: 0,
  btcSold: 0,
  btcTransferred: 0,
  btcCostBasisUsd: null,
  cashReserveUsd: 0,
  minerHardwareBookValueUsd: 0,
  otherAssetsUsd: 0,
  liabilitiesUsd: 0,
  monthlyAccumulationBtc: 0,
  targetBtc: 250,
  source: 'manual',
  updatedAt: new Date(0).toISOString(),
};

function normalizeTreasury(raw: Partial<TreasuryPosition> | null): TreasuryPosition {
  const base = { ...DEFAULT_TREASURY, ...(raw ?? {}) };
  return {
    btcHoldings: base.btcHoldings ?? 0,
    avgAcquisitionPriceUsd: base.avgAcquisitionPriceUsd ?? 0,
    btcMined: base.btcMined ?? 0,
    btcPurchased: base.btcPurchased ?? 0,
    btcSold: base.btcSold ?? 0,
    btcTransferred: base.btcTransferred ?? 0,
    btcCostBasisUsd: base.btcCostBasisUsd ?? null,
    cashReserveUsd: base.cashReserveUsd ?? 0,
    minerHardwareBookValueUsd: base.minerHardwareBookValueUsd ?? 0,
    otherAssetsUsd: base.otherAssetsUsd ?? 0,
    liabilitiesUsd: base.liabilitiesUsd ?? 0,
    monthlyAccumulationBtc: base.monthlyAccumulationBtc ?? 0,
    targetBtc: base.targetBtc ?? 250,
    source: 'manual',
    updatedAt: base.updatedAt ?? new Date(0).toISOString(),
  };
}

export function createLocalTreasuryRepository(): TreasuryRepository {
  return {
    async get() {
      return normalizeTreasury(readJson<Partial<TreasuryPosition> | null>(TREASURY_KEY, null));
    },
    async save(position) {
      const next = normalizeTreasury({
        ...position,
        source: 'manual',
        updatedAt: nowIso(),
      });
      writeJson(TREASURY_KEY, next);
      return next;
    },
  };
}

export function createLocalDemoModeStore(): DemoModeStore {
  return {
    async isDemoMode() {
      return readJson<boolean>(DEMO_KEY, false);
    },
    async setDemoMode(enabled) {
      writeJson(DEMO_KEY, enabled);
    },
  };
}
