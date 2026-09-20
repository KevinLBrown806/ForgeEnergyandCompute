/**
 * Braiins worker ↔ Forge miner matching report.
 */

import type { MinerAsset, PoolWorker } from './types';
import { findWorkerForAsset, workerNamesMatch } from './fleet';

export interface FleetMatchReport {
  registeredMiners: number;
  matchedWorkers: number;
  unmatchedForgeMiners: MinerAsset[];
  unmatchedBraiinsWorkers: PoolWorker[];
}

export function matchFleetWorkers(
  assets: MinerAsset[],
  workers: PoolWorker[],
): FleetMatchReport {
  const unmatchedForgeMiners: MinerAsset[] = [];
  let matchedWorkers = 0;

  for (const asset of assets) {
    const worker = findWorkerForAsset(asset, workers);
    if (worker) matchedWorkers += 1;
    else unmatchedForgeMiners.push(asset);
  }

  const unmatchedBraiinsWorkers = workers.filter(
    (worker) =>
      !assets.some((asset) => workerNamesMatch(asset.braiinsWorkerName, worker.name)),
  );

  return {
    registeredMiners: assets.length,
    matchedWorkers,
    unmatchedForgeMiners,
    unmatchedBraiinsWorkers,
  };
}
