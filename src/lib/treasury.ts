export interface TreasuryInputs {
  btcHoldings: number;
  avgAcquisitionPriceUsd: number;
  btcPriceUsd: number;
  monthlyAccumulationBtc: number;
  targetBtc: number;
}

export interface TreasuryResult {
  currentValueUsd: number;
  costBasisUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  annualAccumulationBtc: number;
  progressToTargetPct: number;
  /** Months to reach the target at the current accumulation rate. */
  monthsToTarget: number | null;
}

export function computeTreasury(inputs: TreasuryInputs): TreasuryResult {
  const {
    btcHoldings,
    avgAcquisitionPriceUsd,
    btcPriceUsd,
    monthlyAccumulationBtc,
    targetBtc,
  } = inputs;

  const currentValueUsd = btcHoldings * btcPriceUsd;
  const costBasisUsd = btcHoldings * avgAcquisitionPriceUsd;
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

  return {
    currentValueUsd,
    costBasisUsd,
    unrealizedPnlUsd,
    unrealizedPnlPct,
    annualAccumulationBtc,
    progressToTargetPct,
    monthsToTarget,
  };
}
