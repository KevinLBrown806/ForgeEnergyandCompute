/**
 * Owner ledger domain types for Forge API persistence.
 * Mirrors frontend `src/domain/types.ts` with v1.3 extensions.
 */

export type MinerAssetStatus =
  | 'active'
  | 'online'
  | 'offline'
  | 'maintenance'
  | 'repair'
  | 'spare'
  | 'retired'
  | 'ordered'
  | 'shipping'
  | 'deploying'
  | 'sold'
  | 'decommissioned';

export interface MinerAsset {
  id: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  serialNumbers?: string[];
  quantity: number;
  nominalHashrateTh: number;
  wattage: number;
  efficiencyJTh: number | null;
  acquisitionDate: string | null;
  acquisitionCostUsd: number | null;
  shippingCostUsd?: number | null;
  deploymentCostUsd?: number | null;
  deploymentDate?: string | null;
  hostingProvider: string;
  facility: string;
  facilityId?: string | null;
  electricityRatePerKwh: number | null;
  monthlyHostingFeeUsd: number | null;
  pool: string;
  braiinsWorkerName: string | null;
  status: MinerAssetStatus;
  enabled: boolean;
  warrantyExpiration: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type MinerAssetInput = Omit<MinerAsset, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type FacilityStatus = 'active' | 'contracted' | 'planned' | 'ended';

export interface Facility {
  id: string;
  provider: string;
  facilityName: string;
  location: string;
  contractedMW: number;
  deployedMW: number;
  electricityRate: number | null;
  hostingFee: number | null;
  hostingStructure?: string | null;
  term?: string | null;
  agreementStart: string | null;
  agreementEnd: string | null;
  status: FacilityStatus;
  notes: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FacilityInput = Omit<Facility, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type TreasuryTransactionType =
  | 'BTC_MINED'
  | 'BTC_PURCHASE'
  | 'BTC_SALE'
  | 'BTC_TRANSFER_IN'
  | 'BTC_TRANSFER_OUT'
  | 'CASH_CONTRIBUTION'
  | 'CASH_WITHDRAWAL'
  | 'HARDWARE_PURCHASE'
  | 'HOSTING_PAYMENT'
  | 'ELECTRICITY_PAYMENT'
  | 'OTHER_EXPENSE'
  | 'OTHER_INCOME'
  | 'REVERSAL'
  | 'ADJUSTMENT';

export type TreasuryAsset = 'BTC' | 'USD';

export interface TreasuryTransaction {
  id: string;
  date: string;
  transactionType: TreasuryTransactionType;
  asset: TreasuryAsset;
  quantity: number;
  unitPrice: number | null;
  grossAmount: number;
  fee: number;
  counterparty: string;
  account: string;
  minerId: string | null;
  facilityId: string | null;
  memo: string;
  source: 'manual' | 'live' | 'imported';
  externalReference: string | null;
  productionRef?: string | null;
  createdAt: string;
}

export type TreasuryTransactionInput = Omit<TreasuryTransaction, 'createdAt'> & {
  createdAt?: string;
};

export interface TreasuryPosition {
  btcHoldings: number;
  avgAcquisitionPriceUsd: number;
  btcMined: number;
  btcPurchased: number;
  btcSold: number;
  btcTransferred: number;
  btcCostBasisUsd: number | null;
  cashReserveUsd: number;
  minerHardwareBookValueUsd: number;
  otherAssetsUsd: number;
  liabilitiesUsd: number;
  monthlyAccumulationBtc: number;
  targetBtc: number;
  source: 'manual';
  updatedAt: string;
}

export type LiabilityKind =
  | 'equipment_financing'
  | 'hosting_payable'
  | 'other';

export interface Liability {
  id: string;
  kind: LiabilityKind;
  label: string;
  amountUsd: number;
  originalPrincipalUsd?: number | null;
  outstandingPrincipalUsd?: number | null;
  ratePct?: number | null;
  paymentUsd?: number | null;
  maturity?: string | null;
  securedAsset?: string | null;
  counterparty: string;
  notes: string;
  asOf: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LiabilityInput = Omit<Liability, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type CapitalBucketId =
  | 'bitcoin_treasury'
  | 'mining_hardware'
  | 'energy_infrastructure'
  | 'liquidity_cash'
  | 'other';

export interface CapitalAllocationTarget {
  bucket: CapitalBucketId;
  label: string;
  targetPct: number;
}

export interface OwnerAssumptions {
  poolFeePct: number;
  uptimePct: number;
  defaultElectricityRatePerKwh: number;
  efficiencyTargetJTh: number | null;
  monthlyAccumulationBtc: number;
  targetBtc: number;
  otherAssetsUsd: number;
  btcAllocationTargetPct?: number | null;
  miningAllocationTargetPct?: number | null;
  cashAllocationTargetPct?: number | null;
  updatedAt: string;
}

export type ReconciliationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface ReconciliationIssue {
  id: string;
  code: string;
  severity: ReconciliationSeverity;
  title: string;
  detail: string;
  recordType?: string;
  recordId?: string | null;
}

export interface AuditEvent {
  id: string;
  recordType: string;
  recordId: string;
  action: string;
  priorValue: unknown | null;
  newValue: unknown | null;
  source: string;
  createdAt: string;
}

export interface MarketSnapshotRow {
  id: string;
  btcUsd: number | null;
  change24hPct: number | null;
  provider: string;
  sourceTimestamp: string | null;
  ingestedAt: string;
  success: boolean;
  error: string | null;
}

export interface NetworkSnapshotRow {
  id: string;
  networkHashrateEhs: number | null;
  difficulty: number | null;
  blockHeight: number | null;
  blockSubsidyBtc: number | null;
  estimatedNextAdjustment: string | null;
  daysUntilAdjustment: number | null;
  provider: string;
  sourceTimestamp: string | null;
  ingestedAt: string;
  success: boolean;
  error: string | null;
}

export interface ProductionDaily {
  id: string;
  date: string;
  btcProduced: number;
  poolSource: string;
  averageHashrateTh: number | null;
  uptimePct: number | null;
  miningRevenueUsd: number | null;
  powerHostingCostUsd: number | null;
  operatingProfitUsd: number | null;
  provenance: 'LIVE' | 'MANUAL' | 'MODELED' | 'IMPORTED';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BraiinsConnectionStatus {
  configured: boolean;
  authenticated: boolean | null;
  lastSuccessfulSync: string | null;
  workerCount: number | null;
  matchedWorkers: number | null;
  unmatchedWorkers: number | null;
  staleWorkers: number | null;
  lastError: string | null;
  providerErrors: string[];
}

export interface LegacyMigrationStatus {
  status: 'pending' | 'imported' | 'skipped' | 'failed';
  importedAt: string | null;
  fingerprint: string | null;
  notes: string;
  updatedAt: string;
}

export interface OwnerLedgerBackup {
  version: 1;
  exportedAt: string;
  miners: MinerAsset[];
  facilities: Facility[];
  treasury: TreasuryPosition;
  transactions: TreasuryTransaction[];
  liabilities: Liability[];
  assumptions: OwnerAssumptions;
  allocationTargets: CapitalAllocationTarget[];
  productionDaily?: ProductionDaily[];
}

export const DEFAULT_TREASURY: TreasuryPosition = {
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

export const DEFAULT_ASSUMPTIONS: OwnerAssumptions = {
  poolFeePct: 2,
  uptimePct: 98,
  defaultElectricityRatePerKwh: 0.045,
  efficiencyTargetJTh: null,
  monthlyAccumulationBtc: 0,
  targetBtc: 250,
  otherAssetsUsd: 0,
  btcAllocationTargetPct: null,
  miningAllocationTargetPct: null,
  cashAllocationTargetPct: null,
  updatedAt: new Date(0).toISOString(),
};

export const DEFAULT_ALLOCATION_TARGETS: CapitalAllocationTarget[] = [
  { bucket: 'bitcoin_treasury', label: 'Bitcoin treasury', targetPct: 40 },
  { bucket: 'mining_hardware', label: 'Mining hardware', targetPct: 35 },
  { bucket: 'energy_infrastructure', label: 'Energy infrastructure', targetPct: 10 },
  { bucket: 'liquidity_cash', label: 'Liquidity / cash', targetPct: 10 },
  { bucket: 'other', label: 'Other', targetPct: 5 },
];
