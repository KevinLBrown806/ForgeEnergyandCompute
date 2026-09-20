/**
 * Owner-ledger validation. Pure — repositories call these before persist.
 */

import type {
  FacilityInput,
  LiabilityInput,
  MinerAsset,
  MinerAssetInput,
  TreasuryTransactionInput,
} from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T/;

export function isValidIsoDate(value: string | null | undefined): boolean {
  if (value == null || value === '') return true;
  if (!ISO_DATE.test(value) && !ISO_DATE_TIME.test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

export function assertValidDate(
  value: string | null | undefined,
  field: string,
): void {
  if (!isValidIsoDate(value)) {
    throw new ValidationError(`${field} is not a valid date.`);
  }
}

export function assertNonNegative(
  value: number | null | undefined,
  field: string,
): void {
  if (value == null) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${field} cannot be negative.`);
  }
}

export function assertPositiveWhenSet(
  value: number | null | undefined,
  field: string,
): void {
  if (value == null) return;
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`${field} must be greater than zero.`);
  }
}

export function normalizeSerial(serial: string | null | undefined): string {
  return (serial ?? '').trim().toLowerCase();
}

export function collectSerials(asset: Pick<MinerAsset, 'serialNumber' | 'serialNumbers'>): string[] {
  const out = [asset.serialNumber, ...(asset.serialNumbers ?? [])]
    .map(normalizeSerial)
    .filter(Boolean);
  return [...new Set(out)];
}

export function findDuplicateSerial(
  candidate: Pick<MinerAsset, 'id' | 'serialNumber' | 'serialNumbers'>,
  existing: Pick<MinerAsset, 'id' | 'serialNumber' | 'serialNumbers'>[],
): string | null {
  const incoming = collectSerials(candidate);
  for (const asset of existing) {
    if (asset.id === candidate.id) continue;
    const owned = new Set(collectSerials(asset));
    for (const serial of incoming) {
      if (owned.has(serial)) return serial;
    }
  }
  return null;
}

export function validateMinerAsset(
  input: MinerAssetInput,
  existing: MinerAsset[] = [],
): void {
  if (!input.model?.trim()) {
    throw new ValidationError('Model is required.');
  }
  if (!input.serialNumber?.trim()) {
    throw new ValidationError('Serial number is required.');
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    throw new ValidationError('Quantity must be an integer >= 1.');
  }
  if (!Number.isInteger(input.quantity)) {
    throw new ValidationError('Quantity must be a whole number.');
  }
  if (!Number.isFinite(input.nominalHashrateTh) || input.nominalHashrateTh < 0) {
    throw new ValidationError('Hashrate cannot be negative.');
  }
  if (!Number.isFinite(input.wattage) || input.wattage < 0) {
    throw new ValidationError('Wattage cannot be negative.');
  }
  if (input.efficiencyJTh != null) {
    if (!Number.isFinite(input.efficiencyJTh) || input.efficiencyJTh <= 0) {
      throw new ValidationError('Efficiency must be greater than zero J/TH.');
    }
    if (input.efficiencyJTh > 200) {
      throw new ValidationError('Efficiency J/TH is implausibly high.');
    }
  }
  assertPositiveWhenSet(input.electricityRatePerKwh, 'Electricity rate');
  assertNonNegative(input.monthlyHostingFeeUsd, 'Hosting fee');
  assertNonNegative(input.acquisitionCostUsd, 'Purchase price');
  assertNonNegative(input.shippingCostUsd, 'Shipping cost');
  assertNonNegative(input.deploymentCostUsd, 'Deployment cost');
  assertValidDate(input.acquisitionDate, 'Purchase date');
  assertValidDate(input.deploymentDate, 'Deployment date');
  assertValidDate(input.warrantyExpiration, 'Warranty expiration');

  const dup = findDuplicateSerial(
    {
      id: input.id ?? '',
      serialNumber: input.serialNumber,
      serialNumbers: input.serialNumbers,
    },
    existing,
  );
  if (dup) {
    throw new ValidationError(`Serial "${dup}" is already registered.`);
  }
}

export function validateTreasuryTransaction(
  input: TreasuryTransactionInput,
  existingIds: Set<string> = new Set(),
): void {
  if (!input.id?.trim()) {
    throw new ValidationError('Transaction id is required.');
  }
  if (existingIds.has(input.id)) {
    throw new ValidationError(`Duplicate transaction id: ${input.id}`);
  }
  assertValidDate(input.date, 'Transaction date');
  if (!input.date || !isValidIsoDate(input.date)) {
    throw new ValidationError('Transaction date is required.');
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new ValidationError('Quantity cannot be negative.');
  }
  if (input.quantity === 0 && input.grossAmount === 0) {
    throw new ValidationError('Quantity or gross amount is required.');
  }
  assertNonNegative(input.fee, 'Fee');
  assertNonNegative(input.unitPrice, 'Unit price');
  if (!Number.isFinite(input.grossAmount)) {
    throw new ValidationError('Gross amount is required.');
  }
}

export function validateFacility(input: FacilityInput): void {
  if (!input.facilityName?.trim()) {
    throw new ValidationError('Facility name is required.');
  }
  assertNonNegative(input.contractedMW, 'Contracted MW');
  assertNonNegative(input.deployedMW, 'Deployed MW');
  assertPositiveWhenSet(input.electricityRate, 'Electricity rate');
  assertNonNegative(input.hostingFee, 'Hosting fee');
  assertValidDate(input.agreementStart, 'Agreement start');
  assertValidDate(input.agreementEnd, 'Agreement end');
}

export function validateLiability(input: LiabilityInput): void {
  if (!input.label?.trim()) {
    throw new ValidationError('Liability label is required.');
  }
  assertNonNegative(input.amountUsd, 'Liability amount');
  assertValidDate(input.asOf, 'As-of date');
}
