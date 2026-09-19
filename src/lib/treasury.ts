/**
 * Forge treasury valuation & NAV.
 *
 * Treasury cost basis is intentionally independent of mining production math
 * in `src/lib/mining.ts` / `src/domain/fleet.ts`.
 */

export interface TreasuryInputs {
  btcHoldings: number;
  avgAcquisitionPriceUsd: number;
  btcPriceUsd: number;
  monthlyAccumulationBtc: number;
  targetBtc: number;
  /** Lifetime BTC mined (manual tracking). */
  btcMined?: number;
  btcPurchased?: number;
  btcSold?: number;
  btcTransferred?: number;
  /**
   * Explicit total cost basis in USD. When null/undefined, derived as
   * holdings × average acquisition price.
   */
  btcCostBasisUsd?: number | null;
  cashReserveUsd?: number;
  minerHardwareBookValueUsd?: number;
  otherAssetsUsd?: number;
  liabilitiesUsd?: number;
}

export interface TreasuryResult {
  /** BTC market value at the provided spot price. */
  currentValueUsd: number;
  /** BTC cost basis in USD. */
  costBasisUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  annualAccumulationBtc: number;
  progressToTargetPct: number;
  /** Months to reach the target at the current accumulation rate. */
  monthsToTarget: number | null;

  btcMined: number;
  btcPurchased: number;
  btcSold: number;
  btcTransferred: number;

  cashReserveUsd: number;
  minerHardwareBookValueUsd: number;
  otherAssetsUsd: number;
  liabilitiesUsd: number;

  totalAssetValueUsd: number;
  totalLiabilitiesUsd: number;
  /** Forge NAV = total assets − liabilities. */
  forgeNavUsd: number;
  /** BTC market value as a fraction of NAV (null when NAV ≤ 0). */
  btcPctOfNav: number | null;
  /** Mining hardware book value as a fraction of NAV. */
  hardwarePctOfNav: number | null;
  /** Cash as a fraction of NAV. */
  cashPctOfNav: number | null;
}

function pctOfNav(part: number, nav: number): number | null {
  if (nav <= 0) return null;
  return part / nav;
}

export function computeTreasury(inputs: TreasuryInputs): TreasuryResult {
  const {
    btcHoldings,
    avgAcquisitionPriceUsd,
    btcPriceUsd,
    monthlyAccumulationBtc,
    targetBtc,
    btcMined = 0,
    btcPurchased = 0,
    btcSold = 0,
    btcTransferred = 0,
    btcCostBasisUsd = null,
    cashReserveUsd = 0,
    minerHardwareBookValueUsd = 0,
    otherAssetsUsd = 0,
    liabilitiesUsd = 0,
  } = inputs;

  const currentValueUsd = btcHoldings * btcPriceUsd;
  const costBasisUsd =
    btcCostBasisUsd != null && btcCostBasisUsd >= 0
      ? btcCostBasisUsd
      : btcHoldings * avgAcquisitionPriceUsd;
  const unrealizedPnlUsd = currentValueUsd - costBasisUsd;
  const unrealizedPnlPct =
    costBasisUsd > 0 ? unrealizedPnlUsd / costBasisUsd : 0;

  const annualAccumulationBtc = monthlyAccumulationBtc * 12;
  const progressToTargetPct = targetBtc > 0 ? btcHoldings / targetBtc : 0;

  const remaining = targetBtc - btcHoldings;
  const monthsToTarget =
    remaining <= 0
      ? 0
      : monthlyAccumulationBtc > 0
        ? remaining / monthlyAccumulationBtc
        : null;

  const totalAssetValueUsd =
    currentValueUsd +
    cashReserveUsd +
    minerHardwareBookValueUsd +
    otherAssetsUsd;
  const totalLiabilitiesUsd = Math.max(0, liabilitiesUsd);
  const forgeNavUsd = totalAssetValueUsd - totalLiabilitiesUsd;

  return {
    currentValueUsd,
    costBasisUsd,
    unrealizedPnlUsd,
    unrealizedPnlPct,
    annualAccumulationBtc,
    progressToTargetPct,
    monthsToTarget,
    btcMined,
    btcPurchased,
    btcSold,
    btcTransferred,
    cashReserveUsd,
    minerHardwareBookValueUsd,
    otherAssetsUsd,
    liabilitiesUsd: totalLiabilitiesUsd,
    totalAssetValueUsd,
    totalLiabilitiesUsd,
    forgeNavUsd,
    btcPctOfNav: pctOfNav(currentValueUsd, forgeNavUsd),
    hardwarePctOfNav: pctOfNav(minerHardwareBookValueUsd, forgeNavUsd),
    cashPctOfNav: pctOfNav(cashReserveUsd, forgeNavUsd),
  };
}
