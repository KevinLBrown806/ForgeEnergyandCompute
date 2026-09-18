import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccumulationChart } from './components/AccumulationChart';
import { AllocationChart } from './components/AllocationChart';
import { FleetRegistry } from './components/FleetRegistry';
import { MiningCalculator } from './components/MiningCalculator';
import { Nav } from './components/Nav';
import { OperationsAlerts } from './components/OperationsAlerts';
import { StatCard } from './components/StatCard';
import { TreasuryEditor } from './components/TreasuryEditor';
import { WorkersPanel } from './components/WorkersPanel';
import {
  createLocalDemoModeStore,
  createLocalFleetRepository,
  createLocalTreasuryRepository,
} from './adapters/localStorage';
import {
  capitalAllocation,
  energy,
  flywheel,
  market,
  roadmap,
  treasuryDefaults,
  type AssetStatus,
  type RoadmapStatus,
} from './config/forge.config';
import { DEMO_FLEET } from './config/demoFleet';
import {
  aggregateFleet,
  buildFleetRows,
  buildOperationsAlerts,
} from './domain/fleet';
import type {
  MinerAsset,
  MinerAssetInput,
  MiningSummaryResponse,
  TreasuryPosition,
} from './domain/types';
import {
  formatBtc,
  formatHashrate,
  formatMw,
  formatNumber,
  formatPercent,
  formatUsd,
  formatUsdCompact,
} from './lib/format';
import { btcPerThPerDay } from './lib/mining';
import { computeTreasury } from './lib/treasury';
import { fetchMiningSummary } from './services/forgeApi';

const fleetRepository = createLocalFleetRepository();
const treasuryRepository = createLocalTreasuryRepository();
const demoModeStore = createLocalDemoModeStore();

const EMPTY_SUMMARY: MiningSummaryResponse = {
  ok: false,
  configured: false,
  fetchedAt: null,
  account: null,
  workers: [],
  rewards: [],
  payouts: [],
  error: null,
};

const DEFAULT_TREASURY: TreasuryPosition = {
  btcHoldings: treasuryDefaults.btcHoldings,
  avgAcquisitionPriceUsd: treasuryDefaults.avgAcquisitionPriceUsd,
  monthlyAccumulationBtc: treasuryDefaults.monthlyAccumulationBtc,
  targetBtc: treasuryDefaults.targetBtc,
  source: 'manual',
  updatedAt: new Date(0).toISOString(),
};

const production = btcPerThPerDay(market.network);

function App() {
  const [storedAssets, setStoredAssets] = useState<MinerAsset[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [treasury, setTreasury] =
    useState<TreasuryPosition>(DEFAULT_TREASURY);
  const [pool, setPool] = useState<MiningSummaryResponse>(EMPTY_SUMMARY);
  const [poolLoading, setPoolLoading] = useState(true);

  const reloadFleet = useCallback(async () => {
    setStoredAssets(await fleetRepository.list());
  }, []);

  const reloadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      setPool(await fetchMiningSummary());
    } finally {
      setPoolLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fleetRepository.list(),
      treasuryRepository.get(),
      demoModeStore.isDemoMode(),
    ]).then(([assets, position, isDemo]) => {
      if (controller.signal.aborted) return;
      setStoredAssets(assets);
      setTreasury(position);
      setDemoMode(isDemo);
    });
    void fetchMiningSummary(controller.signal).then((summary) => {
      if (!controller.signal.aborted) {
        setPool(summary);
        setPoolLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  const assets = demoMode ? DEMO_FLEET : storedAssets;
  const rows = useMemo(
    () =>
      buildFleetRows({
        assets,
        workers: pool.workers,
        btcPerThPerDay: production,
        btcPriceUsd: market.btcPriceUsd,
        poolFeePct: market.poolFeePct,
        defaultElectricityRatePerKwh: energy.avgElectricityRatePerKwh,
      }),
    [assets, pool.workers],
  );
  const aggregate = useMemo(
    () =>
      aggregateFleet({
        rows,
        rewards: pool.rewards,
        payouts: pool.payouts,
        unpaidBalanceBtc: pool.account?.currentBalanceBtc ?? null,
        btcEarnedToday: pool.account?.todayRewardBtc ?? null,
      }),
    [pool.account, pool.payouts, pool.rewards, rows],
  );
  const alerts = useMemo(
    () =>
      buildOperationsAlerts({
        rows,
        workers: pool.workers,
        poolConfigured: pool.configured,
        poolError: pool.error,
      }),
    [pool.configured, pool.error, pool.workers, rows],
  );
  const treasuryResult = computeTreasury({
    ...treasury,
    btcPriceUsd: market.btcPriceUsd,
  });
  const minerLoadMw =
    assets
      .filter((asset) => asset.enabled && asset.status === 'active')
      .reduce(
        (sum, asset) => sum + asset.quantity * asset.wattage,
        0,
      ) / 1_000_000;
  const utilization =
    energy.availableMw > 0 ? energy.deployedMw / energy.availableMw : 0;

  const createAsset = async (input: MinerAssetInput) => {
    await fleetRepository.create(input);
    await reloadFleet();
  };
  const updateAsset = async (id: string, input: MinerAssetInput) => {
    await fleetRepository.update(id, input);
    await reloadFleet();
  };
  const removeAsset = async (id: string) => {
    await fleetRepository.remove(id);
    await reloadFleet();
  };
  const toggleAsset = async (asset: MinerAsset) => {
    await fleetRepository.update(asset.id, { enabled: !asset.enabled });
    await reloadFleet();
  };
  const changeDemoMode = async (enabled: boolean) => {
    await demoModeStore.setDemoMode(enabled);
    setDemoMode(enabled);
  };
  const saveTreasury = async (position: TreasuryPosition) => {
    setTreasury(await treasuryRepository.save(position));
  };

  return (
    <div className="page">
      <Nav />

      <main>
        <section className="lede-row">
          <div>
            <p className="eyebrow">Operating dashboard</p>
            <h1>Energy → Compute → Bitcoin → Treasury</h1>
          </div>
          <p className="lede-row__note">
            Fleet registry + Braiins Pool telemetry
            {demoMode ? ' · DEMO MODE' : ''}
          </p>
        </section>

        <Section id="overview" title="Executive overview · actual">
          <div className="grid grid--cards">
            <StatCard
              label="Registered Miners · Actual"
              value={formatNumber(aggregate.registeredMiners)}
              hint={`${aggregate.enabledMiners} enabled`}
            />
            <StatCard
              label="Online Miners · Actual"
              value={formatNumber(aggregate.onlineMiners)}
              hint={`${aggregate.degradedMiners} degraded · ${aggregate.offlineMiners} offline`}
              tone={aggregate.offlineMiners ? 'negative' : 'positive'}
            />
            <StatCard
              label="Pool Hashrate 5m · Actual"
              value={formatHashrate(aggregate.currentHashrateTh)}
              hint={`${formatHashrate(aggregate.expectedHashrateTh)} expected`}
            />
            <StatCard
              label="Fleet Efficiency · Actual"
              value={
                aggregate.fleetEfficiencyPct == null
                  ? '—'
                  : formatPercent(aggregate.fleetEfficiencyPct)
              }
              hint="5m hashrate / registered nominal"
            />
            <StatCard
              label="BTC Earned Today · Actual"
              value={
                aggregate.btcEarnedToday == null
                  ? '—'
                  : formatBtc(aggregate.btcEarnedToday)
              }
              tone="btc"
            />
            <StatCard
              label="BTC Earned 30d · Actual"
              value={
                aggregate.btcEarned30d == null
                  ? '—'
                  : formatBtc(aggregate.btcEarned30d)
              }
              tone="btc"
            />
            <StatCard
              label="Unpaid Pool Balance · Actual"
              value={
                aggregate.unpaidBalanceBtc == null
                  ? '—'
                  : formatBtc(aggregate.unpaidBalanceBtc)
              }
            />
            <StatCard
              label="Mining Contribution · Actual"
              value={formatUsdCompact(
                aggregate.miningContributionMonthlyUsd,
              )}
              hint="Live 24h production less registered costs"
              tone={
                aggregate.miningContributionMonthlyUsd >= 0
                  ? 'positive'
                  : 'negative'
              }
            />
          </div>
          <div className="overview-alerts">
            <OperationsAlerts alerts={alerts} />
          </div>
        </Section>

        <Section id="treasury" title="Bitcoin treasury · manual">
          <div className="split">
            <div className="grid grid--cards grid--compact">
              <StatCard
                label="BTC Holdings · Manual"
                value={formatBtc(treasury.btcHoldings)}
                tone="btc"
              />
              <StatCard
                label="Avg Acquisition"
                value={formatUsd(treasury.avgAcquisitionPriceUsd)}
              />
              <StatCard
                label="Current Value"
                value={formatUsdCompact(treasuryResult.currentValueUsd)}
              />
              <StatCard
                label="Unrealized P/L"
                value={formatUsdCompact(treasuryResult.unrealizedPnlUsd)}
                hint={formatPercent(treasuryResult.unrealizedPnlPct)}
                tone={
                  treasuryResult.unrealizedPnlUsd >= 0
                    ? 'positive'
                    : 'negative'
                }
              />
              <StatCard
                label="Monthly Accumulation"
                value={formatBtc(treasury.monthlyAccumulationBtc)}
              />
              <StatCard
                label="Long-term Target"
                value={formatBtc(treasury.targetBtc, 0)}
                hint={`${formatPercent(treasuryResult.progressToTargetPct, 0)} reached`}
              />
            </div>
            <div className="panel">
              <TreasuryEditor
                key={treasury.updatedAt}
                position={treasury}
                onSave={saveTreasury}
              />
            </div>
          </div>
          <div className="panel treasury-chart">
            <div className="panel__head">
              <h3>BTC accumulation</h3>
              <span className="panel__meta">
                History is not inferred from the manual position
              </span>
            </div>
            <AccumulationChart
              data={[...treasuryDefaults.accumulationHistory]}
              targetBtc={treasury.targetBtc}
            />
          </div>
        </Section>

        <Section id="fleet" title="Fleet registry">
          <FleetRegistry
            assets={assets}
            rows={rows}
            workers={pool.workers}
            demoMode={demoMode}
            onDemoModeChange={changeDemoMode}
            onCreate={createAsset}
            onUpdate={updateAsset}
            onRemove={removeAsset}
            onToggleEnabled={toggleAsset}
          />
        </Section>

        <Section id="mining" title="Mining operations">
          <WorkersPanel
            workers={pool.workers}
            configured={pool.configured}
            fetchedAt={pool.fetchedAt}
            onRefresh={() => void reloadPool()}
          />
          {poolLoading && <p className="notice">Refreshing pool telemetry…</p>}
          <div className="panel calculator-panel">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Forecast / scenario</p>
                <h3>Mining economics calculator</h3>
              </div>
              <span className="panel__meta">
                Assumptions only · not operating fleet data
              </span>
            </div>
            <MiningCalculator />
          </div>
        </Section>

        <Section id="energy" title="Energy & infrastructure">
          <div className="grid grid--cards grid--compact">
            <StatCard
              label="Available Power · Plan"
              value={formatMw(energy.availableMw)}
            />
            <StatCard
              label="Deployed Power · Plan"
              value={formatMw(energy.deployedMw)}
            />
            <StatCard
              label="Avg Electricity Rate · Plan"
              value={`$${energy.avgElectricityRatePerKwh.toFixed(3)}`}
              hint="per kWh"
            />
            <StatCard
              label="Registered Miner Load"
              value={formatMw(minerLoadMw)}
            />
            <StatCard
              label="Infra Utilization · Plan"
              value={formatPercent(utilization, 0)}
              hint="deployed / available"
            />
          </div>
          <div className="panel">
            <div className="panel__head">
              <h3>Energy assets</h3>
              <span className="panel__meta">Current &amp; planned generation</span>
            </div>
            <div className="asset-grid">
              {energy.sources.map((source) => (
                <div key={source.name} className="asset">
                  <div className="asset__top">
                    <span className="asset__name">{source.name}</span>
                    <AssetStatusBadge status={source.status} />
                  </div>
                  <p className="asset__note">{source.note}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section id="capital" title="Capital allocation · plan">
          <div className="panel panel--center">
            <AllocationChart slices={capitalAllocation} />
          </div>
        </Section>

        <Section id="strategy" title="Strategy & roadmap">
          <div className="split split--strategy">
            <div className="panel">
              <div className="panel__head">
                <h3>The Forge flywheel</h3>
              </div>
              <ol className="flywheel">
                {flywheel.map((step, index) => (
                  <li key={step} className="flywheel__step">
                    <span className="flywheel__num">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="panel">
              <div className="panel__head">
                <h3>Roadmap</h3>
              </div>
              <ol className="roadmap">
                {roadmap.map((step) => (
                  <li key={step.title} className="roadmap__step">
                    <RoadmapDot status={step.status} />
                    <span className="roadmap__title">{step.title}</span>
                    <RoadmapStatusLabel status={step.status} />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Section>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Forge Energy &amp; Compute</span>
        <span className="footer__note">
          v1.1 mining OS · local registry + Forge API
        </span>
      </footer>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="section" aria-labelledby={`${id}-title`}>
      <div className="section__head">
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  active: 'Active',
  planned: 'Planned',
  exploring: 'Exploring',
};

function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      {ASSET_STATUS_LABEL[status]}
    </span>
  );
}

const ROADMAP_STATUS_LABEL: Record<RoadmapStatus, string> = {
  done: 'Done',
  in_progress: 'In progress',
  planned: 'Planned',
};

function RoadmapDot({ status }: { status: RoadmapStatus }) {
  return (
    <span
      className={`roadmap__dot roadmap__dot--${status}`}
      aria-hidden="true"
    />
  );
}

function RoadmapStatusLabel({ status }: { status: RoadmapStatus }) {
  return (
    <span className={`roadmap__status roadmap__status--${status}`}>
      {ROADMAP_STATUS_LABEL[status]}
    </span>
  );
}

export default App;
