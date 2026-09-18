import type {
  AlertSeverity,
  FleetAggregate,
  FleetRow,
  MinerAsset,
  MinerHealthState,
  MiningEconomics,
  MiningReward,
  OperationsAlert,
  PoolPayout,
  PoolWorker,
} from './types';

/** Live hashrate below this fraction of expected → DEGRADED. */
export const HASHRATE_DEGRADED_THRESHOLD = 0.75;

/** Shares older than this are stale. */
export const STALE_SHARE_MS = 30 * 60 * 1000;

const SATS_PER_BTC = 100_000_000;
const DAYS_PER_MONTH = 30.4375;

export function satsToBtc(sats: number): number {
  return sats / SATS_PER_BTC;
}

export function normalizeWorkerName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

/**
 * Braiins keys are often `account.worker`.
 * Match full name or the suffix after the final `.`.
 */
export function workerNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeWorkerName(a);
  const nb = normalizeWorkerName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const aTail = na.includes('.') ? na.slice(na.lastIndexOf('.') + 1) : na;
  const bTail = nb.includes('.') ? nb.slice(nb.lastIndexOf('.') + 1) : nb;
  return aTail.length > 0 && aTail === bTail;
}

export function findWorkerForAsset(
  asset: MinerAsset,
  workers: PoolWorker[],
): PoolWorker | null {
  if (!asset.braiinsWorkerName) return null;
  return (
    workers.find((w) => workerNamesMatch(w.name, asset.braiinsWorkerName)) ??
    null
  );
}

export function expectedHashrateTh(asset: MinerAsset): number {
  if (!asset.enabled || asset.status !== 'active') return 0;
  return asset.quantity * asset.nominalHashrateTh;
}

export function deriveHealth(args: {
  asset: MinerAsset;
  worker: PoolWorker | null;
  nowMs?: number;
}): MinerHealthState {
  const { asset, worker } = args;
  const now = args.nowMs ?? Date.now();

  if (!asset.enabled || asset.status !== 'active') {
    return 'NO_DATA';
  }

  if (!asset.braiinsWorkerName || !worker) {
    return 'UNMAPPED';
  }

  const state = worker.state.toLowerCase();
  if (state === 'off' || state === 'offline') {
    return 'OFFLINE';
  }

  if (worker.lastShareAt) {
    const last = Date.parse(worker.lastShareAt);
    if (Number.isFinite(last) && now - last > STALE_SHARE_MS) {
      return 'OFFLINE';
    }
  }

  const expected = expectedHashrateTh(asset);
  if (expected > 0 && worker.hashRate5mTh / expected < HASHRATE_DEGRADED_THRESHOLD) {
    return 'DEGRADED';
  }

  if (state === 'low') return 'DEGRADED';
  if (state === 'dis' || state === 'disabled') return 'NO_DATA';

  return 'ONLINE';
}

export function dailyPowerCostUsd(
  asset: MinerAsset,
  defaultRatePerKwh: number,
): number {
  if (!asset.enabled || asset.status !== 'active') return 0;
  const rate = asset.electricityRatePerKwh ?? defaultRatePerKwh;
  const kwhPerDay = (asset.quantity * asset.wattage * 24) / 1000;
  const hostingPerDay = (asset.monthlyHostingFeeUsd ?? 0) / DAYS_PER_MONTH;
  return kwhPerDay * rate + hostingPerDay;
}

export function computeRowEconomics(args: {
  asset: MinerAsset;
  live24hTh: number | null;
  btcPerThPerDay: number;
  btcPriceUsd: number;
  poolFeePct: number;
  defaultElectricityRatePerKwh: number;
}): MiningEconomics {
  const hashrate = args.live24hTh ?? 0;
  const btcPerDay = hashrate * args.btcPerThPerDay * (1 - args.poolFeePct);
  const estimatedRevenuePerDayUsd = btcPerDay * args.btcPriceUsd;
  const operatingCostPerDayUsd = dailyPowerCostUsd(
    args.asset,
    args.defaultElectricityRatePerKwh,
  );
  const netContributionPerDayUsd =
    estimatedRevenuePerDayUsd - operatingCostPerDayUsd;

  return {
    btcPerDay,
    estimatedRevenuePerDayUsd,
    estimatedRevenuePerMonthUsd: estimatedRevenuePerDayUsd * DAYS_PER_MONTH,
    operatingCostPerDayUsd,
    operatingCostPerMonthUsd: operatingCostPerDayUsd * DAYS_PER_MONTH,
    netContributionPerDayUsd,
    netContributionPerMonthUsd: netContributionPerDayUsd * DAYS_PER_MONTH,
    revenuePerThUsd:
      hashrate > 0 ? estimatedRevenuePerDayUsd / hashrate : null,
    costPerBtcUsd:
      btcPerDay > 0 ? operatingCostPerDayUsd / btcPerDay : null,
  };
}

export function buildFleetRows(args: {
  assets: MinerAsset[];
  workers: PoolWorker[];
  btcPerThPerDay: number;
  btcPriceUsd: number;
  poolFeePct: number;
  defaultElectricityRatePerKwh: number;
  nowMs?: number;
}): FleetRow[] {
  return args.assets.map((asset) => {
    const worker = findWorkerForAsset(asset, args.workers);
    const health = deriveHealth({ asset, worker, nowMs: args.nowMs });
    const expected = expectedHashrateTh(asset);
    const live5mTh = worker?.hashRate5mTh ?? null;
    const live60mTh = worker?.hashRate60mTh ?? null;
    const live24hTh = worker?.hashRate24hTh ?? null;

    return {
      asset,
      worker,
      health,
      expectedHashrateTh: expected,
      live5mTh,
      live60mTh,
      live24hTh,
      pctOfExpected:
        expected > 0 && live5mTh != null ? live5mTh / expected : null,
      lastShareAt: worker?.lastShareAt ?? null,
      workerState: worker?.state ?? null,
      economics: computeRowEconomics({
        asset,
        live24hTh,
        btcPerThPerDay: args.btcPerThPerDay,
        btcPriceUsd: args.btcPriceUsd,
        poolFeePct: args.poolFeePct,
        defaultElectricityRatePerKwh: args.defaultElectricityRatePerKwh,
      }),
    };
  });
}

function sumRewards(rewards: MiningReward[], days: number, nowMs: number): number {
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  return rewards
    .filter((r) => {
      const t = Date.parse(r.date);
      return Number.isFinite(t) && t >= cutoff;
    })
    .reduce((sum, r) => sum + r.totalRewardBtc, 0);
}

export function aggregateFleet(args: {
  rows: FleetRow[];
  rewards: MiningReward[];
  payouts: PoolPayout[];
  unpaidBalanceBtc: number | null;
  btcEarnedToday: number | null;
  nowMs?: number;
}): FleetAggregate {
  const now = args.nowMs ?? Date.now();
  const enabled = args.rows.filter(
    (r) => r.asset.enabled && r.asset.status === 'active',
  );

  const expectedHashrateThSum = enabled.reduce(
    (s, r) => s + r.expectedHashrateTh,
    0,
  );
  const currentHashrateTh = enabled.reduce((s, r) => s + (r.live5mTh ?? 0), 0);
  const average24hHashrateTh = enabled.reduce(
    (s, r) => s + (r.live24hTh ?? 0),
    0,
  );

  const grossMiningRevenueMonthlyUsd = enabled.reduce(
    (s, r) => s + r.economics.estimatedRevenuePerMonthUsd,
    0,
  );
  const operatingExpensesMonthlyUsd = enabled.reduce(
    (s, r) => s + r.economics.operatingCostPerMonthUsd,
    0,
  );
  const estimatedMonthlyBtc = enabled.reduce(
    (s, r) => s + r.economics.btcPerDay * DAYS_PER_MONTH,
    0,
  );

  const lastPayout =
    [...args.payouts].sort((a, b) => {
      const ta = Date.parse(a.resolvedAt ?? a.requestedAt ?? '') || 0;
      const tb = Date.parse(b.resolvedAt ?? b.requestedAt ?? '') || 0;
      return tb - ta;
    })[0] ?? null;

  return {
    registeredMiners: args.rows.reduce((s, r) => s + r.asset.quantity, 0),
    enabledMiners: enabled.reduce((s, r) => s + r.asset.quantity, 0),
    onlineMiners: enabled
      .filter((r) => r.health === 'ONLINE')
      .reduce((sum, r) => sum + r.asset.quantity, 0),
    offlineMiners: enabled
      .filter((r) => r.health === 'OFFLINE')
      .reduce((sum, r) => sum + r.asset.quantity, 0),
    degradedMiners: enabled
      .filter((r) => r.health === 'DEGRADED')
      .reduce((sum, r) => sum + r.asset.quantity, 0),
    unmappedMiners: enabled
      .filter((r) => r.health === 'UNMAPPED')
      .reduce((sum, r) => sum + r.asset.quantity, 0),
    expectedHashrateTh: expectedHashrateThSum,
    currentHashrateTh,
    average24hHashrateTh,
    fleetEfficiencyPct:
      expectedHashrateThSum > 0
        ? currentHashrateTh / expectedHashrateThSum
        : null,
    btcEarnedToday: args.btcEarnedToday,
    btcEarned7d: args.rewards.length ? sumRewards(args.rewards, 7, now) : null,
    btcEarned30d: args.rewards.length ? sumRewards(args.rewards, 30, now) : null,
    estimatedMonthlyBtc,
    lastPayout,
    unpaidBalanceBtc: args.unpaidBalanceBtc,
    grossMiningRevenueMonthlyUsd,
    operatingExpensesMonthlyUsd,
    miningContributionMonthlyUsd:
      grossMiningRevenueMonthlyUsd - operatingExpensesMonthlyUsd,
    revenuePerThUsd:
      average24hHashrateTh > 0
        ? grossMiningRevenueMonthlyUsd / DAYS_PER_MONTH / average24hHashrateTh
        : expectedHashrateThSum > 0
          ? grossMiningRevenueMonthlyUsd / DAYS_PER_MONTH / expectedHashrateThSum
          : null,
    costPerBtcUsd:
      estimatedMonthlyBtc > 0
        ? operatingExpensesMonthlyUsd / estimatedMonthlyBtc
        : null,
  };
}

export function detectDuplicateWorkerMappings(assets: MinerAsset[]): string[] {
  const mapped = assets.filter((asset) => asset.braiinsWorkerName);
  const duplicateNames = new Set<string>();

  mapped.forEach((asset, index) => {
    for (const other of mapped.slice(index + 1)) {
      if (workerNamesMatch(asset.braiinsWorkerName, other.braiinsWorkerName)) {
        duplicateNames.add(normalizeWorkerName(asset.braiinsWorkerName));
      }
    }
  });

  return [...duplicateNames].sort();
}

export function buildOperationsAlerts(args: {
  rows: FleetRow[];
  workers: PoolWorker[];
  poolConfigured: boolean;
  poolError: string | null;
  nowMs?: number;
}): OperationsAlert[] {
  const alerts: OperationsAlert[] = [];
  const { rows, workers, poolConfigured, poolError } = args;
  const nowMs = args.nowMs ?? Date.now();

  if (poolError) {
    alerts.push({
      id: 'pool-unavailable',
      kind: 'pool_unavailable',
      severity: 'warning',
      title: 'Pool telemetry unavailable',
      detail: poolError,
      assetId: null,
      workerName: null,
    });
  }

  for (const name of detectDuplicateWorkerMappings(rows.map((r) => r.asset))) {
    alerts.push({
      id: `dup-${name}`,
      kind: 'duplicate_mapping',
      severity: 'warning',
      title: 'Duplicate worker mapping',
      detail: `Multiple assets map to worker "${name}".`,
      assetId: null,
      workerName: name,
    });
  }

  for (const row of rows) {
    if (!row.asset.enabled || row.asset.status !== 'active') continue;

    if (row.health === 'OFFLINE') {
      const lastShareMs = row.worker?.lastShareAt
        ? Date.parse(row.worker.lastShareAt)
        : NaN;
      const stale =
        Number.isFinite(lastShareMs) && nowMs - lastShareMs > STALE_SHARE_MS;
      alerts.push({
        id: `off-${row.asset.id}`,
        kind: stale ? 'stale_shares' : 'worker_offline',
        severity: 'critical',
        title: stale
          ? `${row.asset.model} has stale shares`
          : `${row.asset.model} offline`,
        detail: row.worker
          ? stale
            ? `Worker ${row.worker.name} has not submitted a share in 30 minutes.`
            : `Worker ${row.worker.name} reports offline.`
          : 'Mapped worker reports offline.',
        assetId: row.asset.id,
        workerName: row.asset.braiinsWorkerName,
      });
    } else if (row.health === 'DEGRADED') {
      const pct =
        row.pctOfExpected != null
          ? `${Math.round(row.pctOfExpected * 100)}%`
          : 'n/a';
      alerts.push({
        id: `deg-${row.asset.id}`,
        kind: 'hashrate_trailing',
        severity: 'warning',
        title: `${row.asset.model} degraded`,
        detail: `Live hashrate is ${pct} of expected ${row.expectedHashrateTh.toFixed(0)} TH/s.`,
        assetId: row.asset.id,
        workerName: row.asset.braiinsWorkerName,
      });
    } else if (row.health === 'UNMAPPED' && !row.asset.braiinsWorkerName) {
      alerts.push({
        id: `unmap-asset-${row.asset.id}`,
        kind: 'unmapped_miner',
        severity: 'info',
        title: 'Miner has no Braiins worker',
        detail: `${row.asset.model} (${row.asset.id}) is not linked to a pool worker.`,
        assetId: row.asset.id,
        workerName: null,
      });
    } else if (row.health === 'UNMAPPED' && row.asset.braiinsWorkerName) {
      alerts.push({
        id: `unmap-worker-${row.asset.id}`,
        kind: 'unmapped_miner',
        severity: 'warning',
        title: 'Worker not found on pool',
        detail: `No Braiins worker matches "${row.asset.braiinsWorkerName}".`,
        assetId: row.asset.id,
        workerName: row.asset.braiinsWorkerName,
      });
    }

  }

  if (poolConfigured) {
    const mapped = rows
      .map((r) => r.asset.braiinsWorkerName)
      .filter((n): n is string => Boolean(n));
    for (const worker of workers) {
      if (!mapped.some((n) => workerNamesMatch(n, worker.name))) {
        alerts.push({
          id: `orphan-${normalizeWorkerName(worker.name)}`,
          kind: 'unmapped_worker',
          severity: 'info',
          title: 'Unmapped pool worker',
          detail: `Braiins worker "${worker.name}" has no registered Forge asset.`,
          assetId: null,
          workerName: worker.name,
        });
      }
    }
  }

  const rank: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function emptyFleetAggregate(): FleetAggregate {
  return {
    registeredMiners: 0,
    enabledMiners: 0,
    onlineMiners: 0,
    offlineMiners: 0,
    degradedMiners: 0,
    unmappedMiners: 0,
    expectedHashrateTh: 0,
    currentHashrateTh: 0,
    average24hHashrateTh: 0,
    fleetEfficiencyPct: null,
    btcEarnedToday: null,
    btcEarned7d: null,
    btcEarned30d: null,
    estimatedMonthlyBtc: 0,
    lastPayout: null,
    unpaidBalanceBtc: null,
    grossMiningRevenueMonthlyUsd: 0,
    operatingExpensesMonthlyUsd: 0,
    miningContributionMonthlyUsd: 0,
    revenuePerThUsd: null,
    costPerBtcUsd: null,
  };
}
