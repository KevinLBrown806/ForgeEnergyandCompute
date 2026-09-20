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
  TreasuryTransactionInput,
} from '../domain/types';

/**
 * Persistence abstraction for fleet inventory.
 * Durable implementation: Forge API + SQLite (`forgeApiRepos`).
 * Legacy localStorage adapters remain for migration only.
 */
export interface FleetRepository {
  list(): Promise<MinerAsset[]>;
  get(id: string): Promise<MinerAsset | null>;
  create(input: MinerAssetInput): Promise<MinerAsset>;
  update(id: string, patch: Partial<MinerAssetInput>): Promise<MinerAsset>;
  remove(id: string): Promise<void>;
  replaceAll(assets: MinerAsset[]): Promise<void>;
}

export interface TreasuryRepository {
  get(): Promise<TreasuryPosition>;
  save(position: TreasuryPosition): Promise<TreasuryPosition>;
}

export interface TreasuryLedgerRepository {
  list(): Promise<TreasuryTransaction[]>;
  append(input: TreasuryTransactionInput): Promise<TreasuryTransaction>;
  remove(id: string): Promise<void>;
}

export interface FacilityRepository {
  list(): Promise<Facility[]>;
  create(input: FacilityInput): Promise<Facility>;
  update(id: string, patch: Partial<FacilityInput>): Promise<Facility>;
  remove(id: string): Promise<void>;
}

export interface LiabilityRepository {
  list(): Promise<Liability[]>;
  create(input: LiabilityInput): Promise<Liability>;
  update(id: string, patch: Partial<LiabilityInput>): Promise<Liability>;
  remove(id: string): Promise<void>;
}

export interface OwnerSettingsRepository {
  getAssumptions(): Promise<OwnerAssumptions>;
  saveAssumptions(next: OwnerAssumptions): Promise<OwnerAssumptions>;
  getAllocationTargets(): Promise<CapitalAllocationTarget[]>;
  saveAllocationTargets(
    targets: CapitalAllocationTarget[],
  ): Promise<CapitalAllocationTarget[]>;
}

export interface DemoModeStore {
  isDemoMode(): Promise<boolean>;
  setDemoMode(enabled: boolean): Promise<void>;
}
