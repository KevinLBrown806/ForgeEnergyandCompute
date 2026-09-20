/**
 * Miner asset ledger helpers — cost basis and deployed capital.
 * Purchase cost is capital, never mixed into operating expense.
 */

import type { MinerAsset } from './types';
import { PRODUCTION_STATUSES } from './types';

export function minerHardwareCostUsd(asset: MinerAsset): number {
  return Math.max(0, asset.acquisitionCostUsd ?? 0) * Math.max(asset.quantity, 0);
}

export function minerShippingCostUsd(asset: MinerAsset): number {
  return Math.max(0, asset.shippingCostUsd ?? 0);
}

export function minerDeploymentCostUsd(asset: MinerAsset): number {
  return Math.max(0, asset.deploymentCostUsd ?? 0);
}

/** Hardware + shipping + deployment. Null when no cost fields are set. */
export function minerTotalCostBasisUsd(asset: MinerAsset): number | null {
  const hardware = asset.acquisitionCostUsd;
  const shipping = asset.shippingCostUsd;
  const deploy = asset.deploymentCostUsd;
  if (hardware == null && shipping == null && deploy == null) return null;
  return minerHardwareCostUsd(asset) + minerShippingCostUsd(asset) + minerDeploymentCostUsd(asset);
}

export function minerDeployedCapitalUsd(asset: MinerAsset): number | null {
  return minerTotalCostBasisUsd(asset);
}

export function isOwnedInventory(asset: MinerAsset): boolean {
  return asset.status !== 'sold';
}

export function isOnlineInventory(asset: MinerAsset): boolean {
  return PRODUCTION_STATUSES.includes(asset.status) && asset.enabled;
}

export interface FleetCapitalTotals {
  minersOwned: number;
  machinesOnline: number;
  totalTh: number;
  totalMw: number;
  originalHardwareCostUsd: number | null;
  deploymentCostUsd: number | null;
  totalDeployedCapitalUsd: number | null;
  estimatedHardwareBookValueUsd: number | null;
}

export function aggregateFleetCapital(
  assets: MinerAsset[],
  hardwareBookOverrideUsd?: number | null,
): FleetCapitalTotals {
  const owned = assets.filter(isOwnedInventory);
  const online = owned.filter(isOnlineInventory);

  const minersOwned = owned.reduce((s, a) => s + a.quantity, 0);
  const machinesOnline = online.reduce((s, a) => s + a.quantity, 0);
  const totalTh = online.reduce((s, a) => s + a.quantity * a.nominalHashrateTh, 0);
  const totalMw = online.reduce((s, a) => s + (a.quantity * a.wattage) / 1_000_000, 0);

  const hasHardware = owned.some((a) => a.acquisitionCostUsd != null);
  const hasDeploy = owned.some(
    (a) => a.deploymentCostUsd != null || a.shippingCostUsd != null,
  );
  const originalHardwareCostUsd = hasHardware
    ? owned.reduce((s, a) => s + minerHardwareCostUsd(a), 0)
    : null;
  const deploymentCostUsd = hasDeploy
    ? owned.reduce(
        (s, a) => s + minerShippingCostUsd(a) + minerDeploymentCostUsd(a),
        0,
      )
    : null;

  const bases = owned.map(minerTotalCostBasisUsd);
  const totalDeployedCapitalUsd = bases.some((b) => b != null)
    ? bases.reduce<number>((s, b) => s + (b ?? 0), 0)
    : null;

  const estimatedHardwareBookValueUsd =
    hardwareBookOverrideUsd != null && hardwareBookOverrideUsd > 0
      ? hardwareBookOverrideUsd
      : originalHardwareCostUsd;

  return {
    minersOwned,
    machinesOnline,
    totalTh,
    totalMw,
    originalHardwareCostUsd,
    deploymentCostUsd,
    totalDeployedCapitalUsd,
    estimatedHardwareBookValueUsd,
  };
}
