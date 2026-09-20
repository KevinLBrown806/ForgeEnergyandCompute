import type { ForgeDb } from '../client.js';
import { newId, nowIso } from '../client.js';
import type {
  Facility,
  FacilityInput,
  MinerAsset,
  MinerAssetInput,
} from '../../domain/owner.js';
import { writeAudit } from './auditRepo.js';

type MinerRow = {
  id: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  serial_numbers_json: string | null;
  quantity: number;
  nominal_hashrate_th: number;
  wattage: number;
  efficiency_j_th: number | null;
  acquisition_date: string | null;
  acquisition_cost_usd: number | null;
  shipping_cost_usd: number | null;
  deployment_cost_usd: number | null;
  deployment_date: string | null;
  hosting_provider: string;
  facility: string;
  facility_id: string | null;
  electricity_rate_per_kwh: number | null;
  monthly_hosting_fee_usd: number | null;
  pool: string;
  braiins_worker_name: string | null;
  status: string;
  enabled: number;
  warranty_expiration: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

function rowToMiner(row: MinerRow): MinerAsset {
  let serialNumbers: string[] | undefined;
  if (row.serial_numbers_json) {
    try {
      serialNumbers = JSON.parse(row.serial_numbers_json) as string[];
    } catch {
      serialNumbers = undefined;
    }
  }
  return {
    id: row.id,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    serialNumbers,
    quantity: row.quantity,
    nominalHashrateTh: row.nominal_hashrate_th,
    wattage: row.wattage,
    efficiencyJTh: row.efficiency_j_th,
    acquisitionDate: row.acquisition_date,
    acquisitionCostUsd: row.acquisition_cost_usd,
    shippingCostUsd: row.shipping_cost_usd,
    deploymentCostUsd: row.deployment_cost_usd,
    deploymentDate: row.deployment_date,
    hostingProvider: row.hosting_provider,
    facility: row.facility,
    facilityId: row.facility_id,
    electricityRatePerKwh: row.electricity_rate_per_kwh,
    monthlyHostingFeeUsd: row.monthly_hosting_fee_usd,
    pool: row.pool,
    braiinsWorkerName: row.braiins_worker_name,
    status: row.status as MinerAsset['status'],
    enabled: Boolean(row.enabled),
    warrantyExpiration: row.warranty_expiration,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeMiner(input: MinerAssetInput, existing?: MinerAsset): MinerAsset {
  const ts = nowIso();
  const quantity = Math.max(1, Math.floor(input.quantity));
  if (input.braiinsWorkerName?.trim() && quantity !== 1) {
    throw new Error('Miners mapped to a Braiins worker must have quantity 1');
  }
  return {
    id: input.id ?? existing?.id ?? newId('asset'),
    manufacturer: (input.manufacturer ?? existing?.manufacturer ?? '').trim(),
    model: input.model.trim(),
    serialNumber: input.serialNumber.trim(),
    serialNumbers: input.serialNumbers ?? existing?.serialNumbers,
    quantity,
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

function assertSerialUnique(
  db: ForgeDb,
  serial: string,
  excludeId?: string,
): void {
  if (!serial) return;
  const row = db
    .prepare(
      `SELECT id FROM miner_assets
       WHERE serial_number = ?
         AND status NOT IN ('sold', 'decommissioned')
         AND (? IS NULL OR id != ?)`,
    )
    .get(serial, excludeId ?? null, excludeId ?? null) as { id: string } | undefined;
  if (row) {
    throw new Error(`Duplicate miner serial number: ${serial}`);
  }
}

export function listMiners(db: ForgeDb): MinerAsset[] {
  const rows = db
    .prepare('SELECT * FROM miner_assets ORDER BY created_at ASC')
    .all() as MinerRow[];
  return rows.map(rowToMiner);
}

export function getMiner(db: ForgeDb, id: string): MinerAsset | null {
  const row = db.prepare('SELECT * FROM miner_assets WHERE id = ?').get(id) as
    | MinerRow
    | undefined;
  return row ? rowToMiner(row) : null;
}

function insertMiner(db: ForgeDb, asset: MinerAsset): void {
  db.prepare(
    `INSERT INTO miner_assets (
      id, manufacturer, model, serial_number, serial_numbers_json, quantity,
      nominal_hashrate_th, wattage, efficiency_j_th, acquisition_date,
      acquisition_cost_usd, shipping_cost_usd, deployment_cost_usd, deployment_date,
      hosting_provider, facility, facility_id, electricity_rate_per_kwh,
      monthly_hosting_fee_usd, pool, braiins_worker_name, status, enabled,
      warranty_expiration, notes, created_at, updated_at
    ) VALUES (
      @id, @manufacturer, @model, @serialNumber, @serialNumbersJson, @quantity,
      @nominalHashrateTh, @wattage, @efficiencyJTh, @acquisitionDate,
      @acquisitionCostUsd, @shippingCostUsd, @deploymentCostUsd, @deploymentDate,
      @hostingProvider, @facility, @facilityId, @electricityRatePerKwh,
      @monthlyHostingFeeUsd, @pool, @braiinsWorkerName, @status, @enabled,
      @warrantyExpiration, @notes, @createdAt, @updatedAt
    )`,
  ).run({
    id: asset.id,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
    serialNumbersJson: asset.serialNumbers
      ? JSON.stringify(asset.serialNumbers)
      : null,
    quantity: asset.quantity,
    nominalHashrateTh: asset.nominalHashrateTh,
    wattage: asset.wattage,
    efficiencyJTh: asset.efficiencyJTh,
    acquisitionDate: asset.acquisitionDate,
    acquisitionCostUsd: asset.acquisitionCostUsd,
    shippingCostUsd: asset.shippingCostUsd ?? null,
    deploymentCostUsd: asset.deploymentCostUsd ?? null,
    deploymentDate: asset.deploymentDate ?? null,
    hostingProvider: asset.hostingProvider,
    facility: asset.facility,
    facilityId: asset.facilityId ?? null,
    electricityRatePerKwh: asset.electricityRatePerKwh,
    monthlyHostingFeeUsd: asset.monthlyHostingFeeUsd,
    pool: asset.pool,
    braiinsWorkerName: asset.braiinsWorkerName,
    status: asset.status,
    enabled: asset.enabled ? 1 : 0,
    warrantyExpiration: asset.warrantyExpiration,
    notes: asset.notes,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  });
}

export function createMiner(db: ForgeDb, input: MinerAssetInput): MinerAsset {
  const asset = normalizeMiner(input);
  if (!asset.model) throw new Error('Miner model is required');
  assertSerialUnique(db, asset.serialNumber);
  const run = db.transaction(() => {
    insertMiner(db, asset);
    writeAudit(db, {
      recordType: 'miner',
      recordId: asset.id,
      action: 'create',
      priorValue: null,
      newValue: asset,
      source: 'api',
    });
  });
  run();
  return asset;
}

export function updateMiner(
  db: ForgeDb,
  id: string,
  patch: Partial<MinerAssetInput>,
): MinerAsset {
  const existing = getMiner(db, id);
  if (!existing) throw new Error(`Miner asset not found: ${id}`);
  const merged = normalizeMiner({ ...existing, ...patch, id }, existing);
  assertSerialUnique(db, merged.serialNumber, id);
  const run = db.transaction(() => {
    db.prepare('DELETE FROM miner_assets WHERE id = ?').run(id);
    insertMiner(db, merged);
    writeAudit(db, {
      recordType: 'miner',
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

export function removeMiner(db: ForgeDb, id: string): void {
  const existing = getMiner(db, id);
  if (!existing) return;
  const run = db.transaction(() => {
    db.prepare('DELETE FROM miner_assets WHERE id = ?').run(id);
    writeAudit(db, {
      recordType: 'miner',
      recordId: id,
      action: 'delete',
      priorValue: existing,
      newValue: null,
      source: 'api',
    });
  });
  run();
}

export function replaceAllMiners(db: ForgeDb, assets: MinerAsset[]): void {
  const run = db.transaction(() => {
    db.prepare('DELETE FROM miner_assets').run();
    for (const asset of assets) {
      assertSerialUnique(db, asset.serialNumber);
      insertMiner(db, asset);
    }
    writeAudit(db, {
      recordType: 'miner',
      recordId: '*',
      action: 'replace_all',
      priorValue: null,
      newValue: { count: assets.length },
      source: 'api',
    });
  });
  run();
}

type FacilityRow = {
  id: string;
  provider: string;
  facility_name: string;
  location: string;
  contracted_mw: number;
  deployed_mw: number;
  electricity_rate: number | null;
  hosting_fee: number | null;
  hosting_structure: string | null;
  term: string | null;
  agreement_start: string | null;
  agreement_end: string | null;
  status: string;
  notes: string;
  active: number;
  created_at: string;
  updated_at: string;
};

function rowToFacility(row: FacilityRow): Facility {
  return {
    id: row.id,
    provider: row.provider,
    facilityName: row.facility_name,
    location: row.location,
    contractedMW: row.contracted_mw,
    deployedMW: row.deployed_mw,
    electricityRate: row.electricity_rate,
    hostingFee: row.hosting_fee,
    hostingStructure: row.hosting_structure,
    term: row.term,
    agreementStart: row.agreement_start,
    agreementEnd: row.agreement_end,
    status: row.status as Facility['status'],
    notes: row.notes,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    hostingStructure: input.hostingStructure ?? existing?.hostingStructure ?? null,
    term: input.term ?? existing?.term ?? null,
    agreementStart: input.agreementStart || null,
    agreementEnd: input.agreementEnd || null,
    status: input.status,
    notes: input.notes ?? '',
    active: input.active ?? existing?.active ?? input.status !== 'ended',
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
}

export function listFacilities(db: ForgeDb): Facility[] {
  const rows = db
    .prepare('SELECT * FROM facilities ORDER BY created_at ASC')
    .all() as FacilityRow[];
  return rows.map(rowToFacility);
}

export function createFacility(db: ForgeDb, input: FacilityInput): Facility {
  if (!input.facilityName?.trim()) throw new Error('Facility name is required');
  const facility = normalizeFacility(input);
  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO facilities (
        id, provider, facility_name, location, contracted_mw, deployed_mw,
        electricity_rate, hosting_fee, hosting_structure, term,
        agreement_start, agreement_end, status, notes, active, created_at, updated_at
      ) VALUES (
        @id, @provider, @facilityName, @location, @contractedMW, @deployedMW,
        @electricityRate, @hostingFee, @hostingStructure, @term,
        @agreementStart, @agreementEnd, @status, @notes, @active, @createdAt, @updatedAt
      )`,
    ).run({
      id: facility.id,
      provider: facility.provider,
      facilityName: facility.facilityName,
      location: facility.location,
      contractedMW: facility.contractedMW,
      deployedMW: facility.deployedMW,
      electricityRate: facility.electricityRate,
      hostingFee: facility.hostingFee,
      hostingStructure: facility.hostingStructure ?? null,
      term: facility.term ?? null,
      agreementStart: facility.agreementStart,
      agreementEnd: facility.agreementEnd,
      status: facility.status,
      notes: facility.notes,
      active: facility.active ? 1 : 0,
      createdAt: facility.createdAt,
      updatedAt: facility.updatedAt,
    });
    writeAudit(db, {
      recordType: 'facility',
      recordId: facility.id,
      action: 'create',
      priorValue: null,
      newValue: facility,
      source: 'api',
    });
  });
  run();
  return facility;
}

export function updateFacility(
  db: ForgeDb,
  id: string,
  patch: Partial<FacilityInput>,
): Facility {
  const existing = listFacilities(db).find((f) => f.id === id);
  if (!existing) throw new Error(`Facility not found: ${id}`);
  const merged = normalizeFacility({ ...existing, ...patch, id }, existing);
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE facilities SET
        provider=@provider, facility_name=@facilityName, location=@location,
        contracted_mw=@contractedMW, deployed_mw=@deployedMW,
        electricity_rate=@electricityRate, hosting_fee=@hostingFee,
        hosting_structure=@hostingStructure, term=@term,
        agreement_start=@agreementStart, agreement_end=@agreementEnd,
        status=@status, notes=@notes, active=@active, updated_at=@updatedAt
       WHERE id=@id`,
    ).run({
      id,
      provider: merged.provider,
      facilityName: merged.facilityName,
      location: merged.location,
      contractedMW: merged.contractedMW,
      deployedMW: merged.deployedMW,
      electricityRate: merged.electricityRate,
      hostingFee: merged.hostingFee,
      hostingStructure: merged.hostingStructure ?? null,
      term: merged.term ?? null,
      agreementStart: merged.agreementStart,
      agreementEnd: merged.agreementEnd,
      status: merged.status,
      notes: merged.notes,
      active: merged.active ? 1 : 0,
      updatedAt: merged.updatedAt,
    });
    writeAudit(db, {
      recordType: 'facility',
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

export function removeFacility(db: ForgeDb, id: string): void {
  const existing = listFacilities(db).find((f) => f.id === id);
  if (!existing) return;
  const run = db.transaction(() => {
    db.prepare('DELETE FROM facilities WHERE id = ?').run(id);
    writeAudit(db, {
      recordType: 'facility',
      recordId: id,
      action: 'delete',
      priorValue: existing,
      newValue: null,
      source: 'api',
    });
  });
  run();
}
