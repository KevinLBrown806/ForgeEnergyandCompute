/**
 * Capital allocation — current vs target buckets.
 * Current weights come from Forge asset values when available.
 */

import type { CapitalAllocationTarget, CapitalBucketId } from './types';

export interface CapitalPosition {
  bitcoinTreasuryUsd: number;
  miningHardwareUsd: number;
  energyInfrastructureUsd: number;
  liquidityCashUsd: number;
  otherUsd: number;
}

export interface CapitalBucketView {
  bucket: CapitalBucketId;
  label: string;
  currentUsd: number;
  currentPct: number | null;
  targetPct: number | null;
  variancePct: number | null;
}

export const DEFAULT_ALLOCATION_TARGETS: CapitalAllocationTarget[] = [
  { bucket: 'bitcoin_treasury', label: 'Bitcoin Treasury', targetPct: 0.45 },
  { bucket: 'mining_hardware', label: 'Mining Hardware', targetPct: 0.3 },
  { bucket: 'energy_infrastructure', label: 'Energy / Infrastructure', targetPct: 0.15 },
  { bucket: 'liquidity_cash', label: 'Liquidity / Cash', targetPct: 0.1 },
  { bucket: 'other', label: 'Other', targetPct: 0 },
];

export function allocationFromPosition(
  position: CapitalPosition,
  targets: CapitalAllocationTarget[] = DEFAULT_ALLOCATION_TARGETS,
): CapitalBucketView[] {
  const total =
    position.bitcoinTreasuryUsd +
    position.miningHardwareUsd +
    position.energyInfrastructureUsd +
    position.liquidityCashUsd +
    position.otherUsd;

  const valueFor = (bucket: CapitalBucketId): number => {
    switch (bucket) {
      case 'bitcoin_treasury':
        return position.bitcoinTreasuryUsd;
      case 'mining_hardware':
        return position.miningHardwareUsd;
      case 'energy_infrastructure':
        return position.energyInfrastructureUsd;
      case 'liquidity_cash':
        return position.liquidityCashUsd;
      case 'other':
        return position.otherUsd;
    }
  };

  return targets.map((target) => {
    const currentUsd = valueFor(target.bucket);
    const currentPct = total > 0 ? currentUsd / total : null;
    const targetPct = target.targetPct;
    const variancePct =
      currentPct != null && targetPct != null ? currentPct - targetPct : null;
    return {
      bucket: target.bucket,
      label: target.label,
      currentUsd,
      currentPct,
      targetPct,
      variancePct,
    };
  });
}

export function toChartSlices(view: CapitalBucketView[]) {
  const total = view.reduce((s, b) => s + Math.max(0, b.currentUsd), 0);
  if (total <= 0) {
    return view
      .filter((b) => (b.targetPct ?? 0) > 0)
      .map((b) => ({ label: b.label, pct: b.targetPct ?? 0 }));
  }
  return view
    .filter((b) => b.currentUsd > 0)
    .map((b) => ({ label: b.label, pct: b.currentUsd / total }));
}
