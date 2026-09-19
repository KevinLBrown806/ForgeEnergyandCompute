import type { MinerAsset, MinerAssetInput, TreasuryPosition } from '../domain/types';

/**
 * Persistence abstraction for fleet inventory.
 * v1.1: localStorage implementation. Swap for a server repository later
 * without rewriting UI components.
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

export interface DemoModeStore {
  isDemoMode(): Promise<boolean>;
  setDemoMode(enabled: boolean): Promise<void>;
}
