/**
 * Bitcoin network provider — hashrate, difficulty, height, subsidy, adjustment.
 * LIVE data comes from the Forge API proxy (mempool.space).
 */

import { market } from '../../config/forge.config';
import { DataSource, type DataSource as DataSourceT } from '../../domain/dataSource';
import { fetchNetworkSnapshot } from '../../services/forgeApi';

export interface NetworkSnapshot {
  networkHashrateEhs: number;
  difficulty: number | null;
  blockHeight: number | null;
  blockSubsidyBtc: number;
  blocksPerDay: number;
  nextDifficultyChangePct: number | null;
  daysUntilAdjustment: number | null;
  estimatedRetargetDate: string | null;
  remainingBlocks: number | null;
  provider: string;
  source: DataSourceT;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

export interface NetworkProvider {
  getSnapshot(): Promise<NetworkSnapshot>;
}

const CACHE_KEY = 'forge.network.snapshot.v1';

function readCache(): NetworkSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NetworkSnapshot;
  } catch {
    return null;
  }
}

function writeCache(snapshot: NetworkSnapshot): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function modeledNetworkSnapshot(): NetworkSnapshot {
  return {
    networkHashrateEhs: market.network.networkHashrateEhs,
    difficulty: null,
    blockHeight: null,
    blockSubsidyBtc: market.network.blockRewardBtc,
    blocksPerDay: market.network.blocksPerDay,
    nextDifficultyChangePct: null,
    daysUntilAdjustment: null,
    estimatedRetargetDate: null,
    remainingBlocks: null,
    provider: 'forge.config',
    source: DataSource.MODELED,
    fetchedAt: null,
    stale: false,
    error: null,
  };
}

export function createLocalNetworkProvider(): NetworkProvider {
  return {
    async getSnapshot() {
      return modeledNetworkSnapshot();
    },
  };
}

export function createForgeNetworkProvider(): NetworkProvider {
  return {
    async getSnapshot() {
      const live = await fetchNetworkSnapshot();
      if (live.ok && live.networkHashrateEhs != null && live.networkHashrateEhs > 0) {
        const snapshot: NetworkSnapshot = {
          networkHashrateEhs: live.networkHashrateEhs,
          difficulty: live.difficulty,
          blockHeight: live.blockHeight,
          blockSubsidyBtc: live.blockSubsidyBtc ?? market.network.blockRewardBtc,
          blocksPerDay: live.blocksPerDay ?? 144,
          nextDifficultyChangePct: live.nextDifficultyChangePct,
          daysUntilAdjustment: live.daysUntilAdjustment,
          estimatedRetargetDate: live.estimatedRetargetDate,
          remainingBlocks: live.remainingBlocks,
          provider: live.provider,
          source: DataSource.LIVE,
          fetchedAt: live.fetchedAt,
          stale: live.stale,
          error: null,
        };
        writeCache(snapshot);
        return snapshot;
      }
      const cached = readCache();
      if (cached && cached.networkHashrateEhs > 0) {
        return { ...cached, stale: true, error: live.error };
      }
      return { ...modeledNetworkSnapshot(), error: live.error };
    },
  };
}
