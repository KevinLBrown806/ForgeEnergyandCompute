import type {
  FacilityInput,
  MinerAssetInput,
  MinerAssetStatus,
} from './owner.js';

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

/** Minimal RFC4180-ish CSV parser (quoted fields, commas, newlines). */
export function parseCsv(text: string): CsvParseResult {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);

  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const data = rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? '').trim();
    });
    return obj;
  });
  return { headers, rows: data };
}

/** Neutralize CSV injection when exporting. */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  const needsQuote = /[",\n\r]/.test(raw) || /^[=+\-@]/.test(raw);
  const escaped = raw.replace(/"/g, '""');
  if (needsQuote || /^[=+\-@]/.test(raw)) {
    return `"${escaped.startsWith('=') || escaped.startsWith('+') || escaped.startsWith('-') || escaped.startsWith('@') ? `'${escaped}` : escaped}"`;
  }
  return escaped;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((r) => r.map(sanitizeCsvCell).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

export const MINER_CSV_TEMPLATE_HEADERS = [
  'manufacturer',
  'model',
  'serial_number',
  'hashrate_th',
  'watts',
  'purchase_cost',
  'shipping_cost',
  'deployment_cost',
  'acquisition_date',
  'deployment_date',
  'host',
  'facility',
  'electricity_rate',
  'hosting_fee',
  'braiins_worker',
  'status',
  'notes',
] as const;

export const FACILITY_CSV_TEMPLATE_HEADERS = [
  'provider',
  'facility_name',
  'location',
  'contracted_mw',
  'deployed_mw',
  'electricity_rate',
  'hosting_fee',
  'hosting_structure',
  'term',
  'contract_start',
  'contract_end',
  'status',
  'notes',
] as const;

export const ACCOUNTING_CSV_TEMPLATE_HEADERS = [
  'date',
  'type',
  'account',
  'amount_usd',
  'btc_quantity',
  'counterparty',
  'memo',
  'external_reference',
] as const;

export type ImportRowAction = 'insert' | 'update' | 'reject';

export interface MinerImportPreviewRow {
  rowNumber: number;
  action: ImportRowAction;
  errors: string[];
  serialNumber: string;
  payload: MinerAssetInput | null;
  existingId?: string;
}

function parseNum(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseStatus(raw: string): MinerAssetStatus {
  const s = raw.toLowerCase() || 'ordered';
  const allowed: MinerAssetStatus[] = [
    'active',
    'online',
    'offline',
    'maintenance',
    'repair',
    'spare',
    'retired',
    'ordered',
    'shipping',
    'deploying',
    'sold',
    'decommissioned',
  ];
  return (allowed.includes(s as MinerAssetStatus) ? s : 'ordered') as MinerAssetStatus;
}

export function previewMinerCsv(
  text: string,
  existing: Array<{ id: string; serialNumber: string }>,
): {
  rows: MinerImportPreviewRow[];
  inserts: number;
  updates: number;
  rejected: number;
} {
  const parsed = parseCsv(text);
  const bySerial = new Map(
    existing
      .filter((e) => e.serialNumber)
      .map((e) => [e.serialNumber.toLowerCase(), e]),
  );
  const seenInFile = new Set<string>();
  const rows: MinerImportPreviewRow[] = [];

  parsed.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const serial = (raw.serial_number ?? '').trim();
    const model = (raw.model ?? '').trim();
    if (!model) errors.push('model is required');
    if (!serial) errors.push('serial_number is required');

    const hashrate = parseNum(raw.hashrate_th ?? '');
    const watts = parseNum(raw.watts ?? '');
    if (hashrate == null || hashrate < 0) errors.push('hashrate_th must be a non-negative number');
    if (watts == null || watts < 0) errors.push('watts must be a non-negative number');

    const serialKey = serial.toLowerCase();
    if (serial && seenInFile.has(serialKey)) {
      errors.push('duplicate serial_number within import file');
    }
    if (serial) seenInFile.add(serialKey);

    const existingMatch = serial ? bySerial.get(serialKey) : undefined;
    if (errors.length) {
      rows.push({
        rowNumber,
        action: 'reject',
        errors,
        serialNumber: serial,
        payload: null,
        existingId: existingMatch?.id,
      });
      return;
    }

    const payload: MinerAssetInput = {
      manufacturer: (raw.manufacturer ?? '').trim(),
      model,
      serialNumber: serial,
      quantity: 1,
      nominalHashrateTh: hashrate!,
      wattage: watts!,
      efficiencyJTh: hashrate! > 0 ? watts! / hashrate! : null,
      acquisitionDate: raw.acquisition_date || null,
      acquisitionCostUsd: parseNum(raw.purchase_cost ?? ''),
      shippingCostUsd: parseNum(raw.shipping_cost ?? ''),
      deploymentCostUsd: parseNum(raw.deployment_cost ?? ''),
      deploymentDate: raw.deployment_date || null,
      hostingProvider: (raw.host ?? '').trim(),
      facility: (raw.facility ?? '').trim(),
      facilityId: null,
      electricityRatePerKwh: parseNum(raw.electricity_rate ?? ''),
      monthlyHostingFeeUsd: parseNum(raw.hosting_fee ?? ''),
      pool: 'Braiins Pool',
      braiinsWorkerName: (raw.braiins_worker ?? '').trim() || null,
      status: parseStatus(raw.status ?? ''),
      enabled: true,
      warrantyExpiration: null,
      notes: raw.notes ?? '',
    };

    rows.push({
      rowNumber,
      action: existingMatch ? 'update' : 'insert',
      errors: [],
      serialNumber: serial,
      payload,
      existingId: existingMatch?.id,
    });
  });

  return {
    rows,
    inserts: rows.filter((r) => r.action === 'insert').length,
    updates: rows.filter((r) => r.action === 'update').length,
    rejected: rows.filter((r) => r.action === 'reject').length,
  };
}

export function previewFacilityCsv(text: string): {
  rows: Array<{
    rowNumber: number;
    action: ImportRowAction;
    errors: string[];
    payload: FacilityInput | null;
  }>;
} {
  const parsed = parseCsv(text);
  const rows = parsed.rows.map((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const facilityName = (raw.facility_name ?? '').trim();
    if (!facilityName) errors.push('facility_name is required');
    if (errors.length) {
      return { rowNumber, action: 'reject' as const, errors, payload: null };
    }
    const payload: FacilityInput = {
      provider: (raw.provider ?? '').trim(),
      facilityName,
      location: (raw.location ?? '').trim(),
      contractedMW: parseNum(raw.contracted_mw ?? '') ?? 0,
      deployedMW: parseNum(raw.deployed_mw ?? '') ?? 0,
      electricityRate: parseNum(raw.electricity_rate ?? ''),
      hostingFee: parseNum(raw.hosting_fee ?? ''),
      hostingStructure: raw.hosting_structure || null,
      term: raw.term || null,
      agreementStart: raw.contract_start || null,
      agreementEnd: raw.contract_end || null,
      status: ((raw.status || 'planned') as FacilityInput['status']),
      notes: raw.notes ?? '',
    };
    return { rowNumber, action: 'insert' as const, errors: [], payload };
  });
  return { rows };
}

export interface AccountingImportRow {
  date: string;
  type: string;
  account: string;
  amountUsd: number | null;
  btcQuantity: number | null;
  counterparty: string;
  memo: string;
  externalReference: string;
}

export function parseAccountingCsv(text: string): {
  rows: AccountingImportRow[];
  errors: string[];
} {
  const parsed = parseCsv(text);
  const errors: string[] = [];
  const rows: AccountingImportRow[] = [];
  parsed.rows.forEach((raw, idx) => {
    const date = raw.date ?? '';
    if (!date) {
      errors.push(`Row ${idx + 2}: date is required`);
      return;
    }
    rows.push({
      date,
      type: (raw.type ?? '').trim(),
      account: (raw.account ?? '').trim(),
      amountUsd: parseNum(raw.amount_usd ?? ''),
      btcQuantity: parseNum(raw.btc_quantity ?? ''),
      counterparty: (raw.counterparty ?? '').trim(),
      memo: raw.memo ?? '',
      externalReference: raw.external_reference ?? '',
    });
  });
  return { rows, errors };
}
