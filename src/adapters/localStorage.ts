import type {
  CapitalAllocationTarget,
  Facility,
  FacilityInput,
  Liability,
  LiabilityInput,
  MinerAsset,
  MinerAssetInput,
  OwnerAssumptions,
  TreasuryPosition,
  TreasuryTransaction,
} from '../domain/types';
import { validateMappedMinerQuantity } from '../domain/fleet';
import {
  validateFacility,
  validateLiability,
  validateMinerAsset,
  validateTreasuryTransaction,
} from '../domain/validation';
import { DEFAULT_ALLOCATION_TARGETS } from '../domain/capital';
import { market, treasuryDefaults } from '../config/forge.config';
import type {
  DemoModeStore,
  FacilityRepository,
  FleetRepository,
  LiabilityRepository,
  OwnerSettingsRepository,
  TreasuryLedgerRepository,
  TreasuryRepository,
} from '../services/repositories';

const FLEET_KEY = 'forge.fleet.v1';
const TREASURY_KEY = 'forge.treasury.v1';
const TREASURY_TX_KEY = 'forge.treasury.tx.v1';
const FACILITY_KEY = 'forge.facilities.v1';
const LIABILITY_KEY = 'forge.liabilities.v1';
const ASSUMPTIONS_KEY = 'forge.assumptions.v1';
const ALLOCATION_KEY = 'forge.allocation.targets.v1';
const DEMO_KEY = 'forge.demoMode.v1';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    id: input.id ?? existing?.id ?? newId('asset'),
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
    acquisitionCostUsd: input.acquisitionCostUsd ?? existing?.acquisitionCostUsd ?? null,
    shippingCostUsd: input.shippingCostUsd ?? existing?.shippingCostUsd ?? null,
    deploymentCostUsd: input.deploymentCostUsd ?? existing?.deploymentCostUsd ?? null,
    deploymentDate: input.deploymentDate || existing?.deploymentDate || null,
    hostingProvider: input.hostingProvider.trim(),
    facility: input.facility.trim(),
    facilityId: input.facilityId ?? existing?.facilityId ?? null,
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
      validateMinerAsset(input, all);
      const asset = normalizeAsset(input);
      all.push(asset);
      writeJson(FLEET_KEY, all);
      return asset;
    },
    async update(id, patch) {
      const all = readJson<MinerAsset[]>(FLEET_KEY, []);
      const idx = all.findIndex((a) => a.id === id);
      if (idx < 0) throw new Error(`Miner asset not found: ${id}`);
      const mergedInput = { ...all[idx], ...patch, id };
      validateMinerAsset(mergedInput, all);
      const merged = normalizeAsset(mergedInput, all[idx]);
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

export function createLocalTreasuryLedgerRepository(): TreasuryLedgerRepository {
  return {
    async list() {
      return readJson<TreasuryTransaction[]>(TREASURY_TX_KEY, []);
    },
    async append(input) {
      const all = readJson<TreasuryTransaction[]>(TREASURY_TX_KEY, []);
      validateTreasuryTransaction(input, new Set(all.map((tx) => tx.id)));
      const tx: TreasuryTransaction = {
        ...input,
        createdAt: input.createdAt ?? nowIso(),
      };
      all.push(tx);
      writeJson(TREASURY_TX_KEY, all);
      return tx;
    },
    async remove(id) {
      const all = readJson<TreasuryTransaction[]>(TREASURY_TX_KEY, []);
      writeJson(
        TREASURY_TX_KEY,
        all.filter((tx) => tx.id !== id),
      );
    },
  };
}

function normalizeFacility(input: FacilityInput, existing?: Facility): Facility {
  const ts = nowIso();
  return {
    id: input.id ?? existing?.id ?? newId('fac'),
    provider: input.provider.trim(),
    facilityName: input.facilityName.trim(),
    location: input.location.trim(),
    contractedMW: Math.max(0, input.contractedMW),
    deployedMW: Math.max(0, input.deployedMW),
    electricityRate: input.electricityRate,
    hostingFee: input.hostingFee,
    agreementStart: input.agreementStart || null,
    agreementEnd: input.agreementEnd || null,
    status: input.status,
    notes: input.notes ?? '',
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
}

export function createLocalFacilityRepository(): FacilityRepository {
  return {
    async list() {
      return readJson<Facility[]>(FACILITY_KEY, []);
    },
    async create(input) {
      validateFacility(input);
      const all = readJson<Facility[]>(FACILITY_KEY, []);
      const facility = normalizeFacility(input);
      all.push(facility);
      writeJson(FACILITY_KEY, all);
      return facility;
    },
    async update(id, patch) {
      const all = readJson<Facility[]>(FACILITY_KEY, []);
      const idx = all.findIndex((f) => f.id === id);
      if (idx < 0) throw new Error(`Facility not found: ${id}`);
      const mergedInput = { ...all[idx], ...patch, id };
      validateFacility(mergedInput);
      const merged = normalizeFacility(mergedInput, all[idx]);
      all[idx] = merged;
      writeJson(FACILITY_KEY, all);
      return merged;
    },
    async remove(id) {
      const all = readJson<Facility[]>(FACILITY_KEY, []);
      writeJson(
        FACILITY_KEY,
        all.filter((f) => f.id !== id),
      );
    },
  };
}

function normalizeLiability(input: LiabilityInput, existing?: Liability): Liability {
  const ts = nowIso();
  return {
    id: input.id ?? existing?.id ?? newId('liab'),
    kind: input.kind,
    label: input.label.trim(),
    amountUsd: Math.max(0, input.amountUsd),
    counterparty: input.counterparty.trim(),
    notes: input.notes ?? '',
    asOf: input.asOf,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
}

export function createLocalLiabilityRepository(): LiabilityRepository {
  return {
    async list() {
      return readJson<Liability[]>(LIABILITY_KEY, []);
    },
    async create(input) {
      validateLiability(input);
      const all = readJson<Liability[]>(LIABILITY_KEY, []);
      const row = normalizeLiability(input);
      all.push(row);
      writeJson(LIABILITY_KEY, all);
      return row;
    },
    async update(id, patch) {
      const all = readJson<Liability[]>(LIABILITY_KEY, []);
      const idx = all.findIndex((l) => l.id === id);
      if (idx < 0) throw new Error(`Liability not found: ${id}`);
      const mergedInput = { ...all[idx], ...patch, id };
      validateLiability(mergedInput);
      const merged = normalizeLiability(mergedInput, all[idx]);
      all[idx] = merged;
      writeJson(LIABILITY_KEY, all);
      return merged;
    },
    async remove(id) {
      const all = readJson<Liability[]>(LIABILITY_KEY, []);
      writeJson(
        LIABILITY_KEY,
        all.filter((l) => l.id !== id),
      );
    },
  };
}

const DEFAULT_ASSUMPTIONS: OwnerAssumptions = {
  poolFeePct: market.poolFeePct,
  uptimePct: market.uptimePct,
  defaultElectricityRatePerKwh: 0.045,
  efficiencyTargetJTh: null,
  monthlyAccumulationBtc: treasuryDefaults.monthlyAccumulationBtc,
  targetBtc: treasuryDefaults.targetBtc,
  otherAssetsUsd: 0,
  updatedAt: new Date(0).toISOString(),
};

export function createLocalOwnerSettingsRepository(): OwnerSettingsRepository {
  return {
    async getAssumptions() {
      return {
        ...DEFAULT_ASSUMPTIONS,
        ...readJson<Partial<OwnerAssumptions>>(ASSUMPTIONS_KEY, {}),
      };
    },
    async saveAssumptions(next) {
      const saved = { ...next, updatedAt: nowIso() };
      writeJson(ASSUMPTIONS_KEY, saved);
      return saved;
    },
    async getAllocationTargets() {
      const stored = readJson<CapitalAllocationTarget[] | null>(ALLOCATION_KEY, null);
      return stored && stored.length ? stored : DEFAULT_ALLOCATION_TARGETS;
    },
    async saveAllocationTargets(targets) {
      writeJson(ALLOCATION_KEY, targets);
      return targets;
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
