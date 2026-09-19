import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccumulationChart } from './components/AccumulationChart';
import { AllocationChart } from './components/AllocationChart';
import { DataProvenancePanel } from './components/DataProvenancePanel';
import { FleetRegistry } from './components/FleetRegistry';
import { MiningCalculator } from './components/MiningCalculator';
import { Nav } from './components/Nav';
import { OperationsAlerts } from './components/OperationsAlerts';
import { OperatorLogin } from './components/OperatorLogin';
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
  infrastructureRoadmap,
  market,
  roadmap,
  treasuryDefaults,
  type AssetStatus,
  type RoadmapStatus,
} from './config/forge.config';
import { DEMO_FLEET } from './config/demoFleet';
import { DataSource } from './domain/dataSource';
import {
  aggregateFleet,
  buildFleetRows,
  buildOperationsAlerts,
  isProductionEligible,
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
  formatJTh,
  formatMw,
  formatNumber,
  formatPercent,
  formatUsd,
  formatUsdCompact,
} from './lib/format';
import {
  btcToSats,
  costToMineOneBtcUsd,
  simpleHardwareRoiAnnual,
  thToPh,
} from './lib/mining';
import { computeTreasury } from './lib/treasury';
import {
  fetchAuthSession,
  fetchMiningSummary,
  loginOperator,
  logoutOperator,
  type AuthSession,
} from './services/forgeApi';
import { createLocalMarketProvider } from './data/forgeData';
import { DAYS_PER_MONTH } from './lib/estimator';

const fleetRepository = createLocalFleetRepository();
const treasuryRepository = createLocalTreasuryRepository();
const demoModeStore = createLocalDemoModeStore();
const marketProvider = createLocalMarketProvider();

const EMPTY_SUMMARY: MiningSummaryResponse = {
  ok: false,
  configured: false,
  fetchedAt: null,
  account: null,
  workers: [],
  rewards: [],
  payouts: [],
  sources: null,
  stale: false,
  error: null,
};

const EMPTY_AUTH: AuthSession = {
  authenticated: false,
  authConfigured: false,
  braiinsConfigured: false,
  authRequired: false,
};

const DEFAULT_TREASURY: TreasuryPosition = {
  btcHoldings: treasuryDefaults.btcHoldings,
  avgAcquisitionPriceUsd: treasuryDefaults.avgAcquisitionPriceUsd,
  btcMined: treasuryDefaults.btcMined,
  btcPurchased: treasuryDefaults.btcPurchased,
  btcSold: treasuryDefaults.btcSold,
  btcTransferred: treasuryDefaults.btcTransferred,
  btcCostBasisUsd: treasuryDefaults.btcCostBasisUsd,
  cashReserveUsd: treasuryDefaults.cashReserveUsd,
  minerHardwareBookValueUsd: treasuryDefaults.minerHardwareBookValueUsd,
  otherAssetsUsd: treasuryDefaults.otherAssetsUsd,
  liabilitiesUsd: treasuryDefaults.liabilitiesUsd,
  monthlyAccumulationBtc: treasuryDefaults.monthlyAccumulationBtc,
  targetBtc: treasuryDefaults.targetBtc,
  source: 'manual',
  updatedAt: new Date(0).toISOString(),
};

const NOT_TRACKED = 'Not yet tracked';

function App() {
  const [storedAssets, setStoredAssets] = useState<MinerAsset[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [treasury, setTreasury] =
    useState<TreasuryPosition>(DEFAULT_TREASURY);
  const [pool, setPool] = useState<MiningSummaryResponse>(EMPTY_SUMMARY);
  const [poolLoading, setPoolLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSession>(EMPTY_AUTH);
  const [btcPerThDay, setBtcPerThDay] = useState(0);

  const reloadFleet = useCallback(async () => {
    setStoredAssets(await fleetRepository.list());
  }, []);

  const reloadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const [session, summary] = await Promise.all([
        fetchAuthSession(),
        fetchMiningSummary(),
      ]);
      setAuthSession(session);
      setPool(summary);
    } finally {
      setPoolLoading(false);
    }
  }, []);

  const handleLogin = useCallback(async (password: string) => {
    const result = await loginOperator(password);
    if (!result.ok) return result.error ?? 'Login failed';
    await reloadPool();
    return null;
  }, [reloadPool]);

  const handleLogout = useCallback(async () => {
    await logoutOperator();
    setAuthSession((current) => ({ ...current, authenticated: false }));
    setPool(EMPTY_SUMMARY);
    await reloadPool();
  }, [reloadPool]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fleetRepository.list(),
      treasuryRepository.get(),
      demoModeStore.isDemoMode(),
      marketProvider.getSnapshot(),
    ]).then(([assets, position, isDemo, marketSnap]) => {
      if (controller.signal.aborted) return;
      setStoredAssets(assets);
      setTreasury(position);
      setDemoMode(isDemo);
      setBtcPerThDay(marketSnap.btcPerThPerDay);
    });
    void Promise.all([
      fetchAuthSession(controller.signal),
      fetchMiningSummary(controller.signal),
    ])
      .then(([session, summary]) => {
        if (!controller.signal.aborted) {
          setAuthSession(session);
          setPool(summary);
          setPoolLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setPool({
            ...EMPTY_SUMMARY,
            error: 'Forge API is unavailable',
          });
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
        btcPerThPerDay: btcPerThDay,
        btcPriceUsd: market.btcPriceUsd,
        poolFeePct: market.poolFeePct,
        defaultElectricityRatePerKwh: energy.avgElectricityRatePerKwh,
      }),
    [assets, pool.workers, btcPerThDay],
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
        sources: pool.sources,
        stale: pool.stale,
      }),
    [pool.configured, pool.error, pool.sources, pool.stale, pool.workers, rows],
  );

  const activeAssets = useMemo(
    () => assets.filter(isProductionEligible),
    [assets],
  );
  const weightedEfficiencyJTh = useMemo(() => {
    const totalTh = activeAssets.reduce(
      (s, a) => s + a.quantity * a.nominalHashrateTh,
      0,
    );
    const totalW = activeAssets.reduce(
      (s, a) => s + a.quantity * a.wattage,
      0,
    );
    return totalTh > 0 ? totalW / totalTh : 0;
  }, [activeAssets]);

  const estimatedBtcPerDay = aggregate.estimatedMonthlyBtc / DAYS_PER_MONTH;
  const fleetPowerKw =
    activeAssets.reduce((s, a) => s + a.quantity * a.wattage, 0) / 1000;

  const treasuryResult = computeTreasury({
    ...treasury,
    btcPriceUsd: market.btcPriceUsd,
  });

  const hardwareBook =
    treasury.minerHardwareBookValueUsd > 0
      ? treasury.minerHardwareBookValueUsd
      : assets.reduce(
          (s, a) => s + (a.acquisitionCostUsd ?? 0) * a.quantity,
          0,
        );
  const fleetHardwareRoi = simpleHardwareRoiAnnual(
    aggregate.miningContributionMonthlyUsd,
    hardwareBook,
  );

  const costPerBtc = costToMineOneBtcUsd(
    aggregate.operatingExpensesMonthlyUsd,
    aggregate.estimatedMonthlyBtc,
  );

  const minerLoadMw = fleetPowerKw / 1000;
  const utilization =
    energy.availableMw > 0 ? energy.deployedMw / energy.availableMw : 0;

  /** BTC MTD: prefer LIVE pool rewards; otherwise MODELED estimate. */
  const btcMinedMtdLive = aggregate.btcEarned30d;
  const btcMinedMtdModeled = aggregate.estimatedMonthlyBtc;
  const hasLiveMtd = btcMinedMtdLive != null;

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
            <p className="eyebrow">Forge OS v1.1 · Live operations</p>
            <h1>Energy → Compute → Bitcoin → Treasury → Infrastructure</h1>
          </div>
          <p className="lede-row__note">
            Fleet registry + Braiins Pool telemetry
            {demoMode ? ' · DEMO MODE' : ''}
          </p>
        </section>

        <DataProvenancePanel />

        {(authSession.authRequired && !authSession.authenticated) ||
        pool.code === 'auth_required' ||
        pool.code === 'auth_not_configured' ? (
          <OperatorLogin
            authConfigured={
              authSession.authConfigured || pool.authConfigured === true
            }
            onLogin={handleLogin}
          />
        ) : null}

        {authSession.authenticated && (
          <div className="auth-bar">
            <span className="auth-bar__status">Operator session active</span>
            <button
              className="button"
              type="button"
              onClick={() => void handleLogout()}
            >
              Sign out
            </button>
          </div>
        )}

        {pool.stale && (
          <p className="notice notice--warning">
            Showing stale Braiins cache for one or more sources after a partial
            upstream failure.
          </p>
        )}

        <Section id="overview" title="Executive overview">
          <div className="grid grid--cards grid--owner">
            <StatCard
              label="Treasury NAV"
              source={DataSource.MANUAL}
              value={formatUsdCompact(treasuryResult.forgeNavUsd)}
              hint={
                treasury.btcHoldings > 0 || treasury.cashReserveUsd > 0
                  ? `Assets ${formatUsdCompact(treasuryResult.totalAssetValueUsd)}`
                  : 'Enter treasury figures to compute NAV'
              }
              tone="btc"
            />
            <StatCard
              label="BTC Treasury"
              source={DataSource.MANUAL}
              value={formatBtc(treasury.btcHoldings)}
              hint={`Mkt ${formatUsdCompact(treasuryResult.currentValueUsd)}`}
              tone="btc"
            />
            <StatCard
              label="Fleet Hashrate"
              source={
                aggregate.currentHashrateTh > 0
                  ? DataSource.LIVE
                  : DataSource.MANUAL
              }
              value={formatHashrate(
                aggregate.currentHashrateTh || aggregate.expectedHashrateTh,
              )}
              hint={
                aggregate.currentHashrateTh > 0
                  ? `${formatHashrate(aggregate.expectedHashrateTh)} expected`
                  : 'Nominal from registry'
              }
            />
            <StatCard
              label="BTC Mined MTD"
              source={hasLiveMtd ? DataSource.LIVE : DataSource.MODELED}
              value={
                hasLiveMtd
                  ? formatBtc(btcMinedMtdLive)
                  : btcMinedMtdModeled > 0
                    ? formatBtc(btcMinedMtdModeled, 3)
                    : '—'
              }
              hint={
                hasLiveMtd
                  ? 'Pool rewards · 30d'
                  : btcMinedMtdModeled > 0
                    ? 'Modeled from hashrate · not settled'
                    : NOT_TRACKED
              }
              tone="btc"
            />
            <StatCard
              label="Mining EBITDA MTD"
              source={DataSource.MODELED}
              value={formatUsdCompact(aggregate.miningContributionMonthlyUsd)}
              hint="Modeled contribution · not settled P&amp;L"
              tone={
                aggregate.miningContributionMonthlyUsd >= 0
                  ? 'positive'
                  : 'negative'
              }
            />
          </div>

          <div className="grid grid--cards grid--compact overview-secondary">
            <StatCard
              label="Online Miners"
              source={DataSource.LIVE}
              value={formatNumber(aggregate.onlineMiners)}
              hint={`${aggregate.degradedMiners} degraded · ${aggregate.offlineMiners} offline`}
              tone={aggregate.offlineMiners ? 'negative' : 'positive'}
            />
            <StatCard
              label="Registered Miners"
              source={DataSource.MANUAL}
              value={formatNumber(aggregate.registeredMiners)}
              hint={`${aggregate.enabledMiners} enabled`}
            />
            <StatCard
              label="BTC Earned Today"
              source={DataSource.LIVE}
              value={
                aggregate.btcEarnedToday == null
                  ? '—'
                  : formatBtc(aggregate.btcEarnedToday)
              }
              tone="btc"
            />
            <StatCard
              label="Unpaid Pool Balance"
              source={DataSource.LIVE}
              value={
                aggregate.unpaidBalanceBtc == null
                  ? '—'
                  : formatBtc(aggregate.unpaidBalanceBtc)
              }
            />
            <StatCard
              label="Fleet Efficiency"
              source={DataSource.MODELED}
              value={
                aggregate.fleetEfficiencyPct == null
                  ? '—'
                  : formatPercent(aggregate.fleetEfficiencyPct)
              }
              hint="5m hashrate / nominal"
            />
            <StatCard
              label="Cost to Mine 1 BTC"
              source={DataSource.MODELED}
              value={
                costPerBtc == null ? '—' : formatUsdCompact(costPerBtc)
              }
            />
          </div>
          <div className="overview-alerts">
            <OperationsAlerts alerts={alerts} />
          </div>
        </Section>

        <Section id="treasury" title="Bitcoin treasury">
          <div className="split">
            <div className="grid grid--cards grid--compact">
              <StatCard
                label="BTC Holdings"
                source={DataSource.MANUAL}
                value={formatBtc(treasury.btcHoldings)}
                tone="btc"
              />
              <StatCard
                label="BTC Market Value"
                source={DataSource.MODELED}
                value={formatUsdCompact(treasuryResult.currentValueUsd)}
                hint={`@ ${formatUsd(market.btcPriceUsd)}`}
              />
              <StatCard
                label="BTC Cost Basis"
                source={DataSource.MANUAL}
                value={formatUsdCompact(treasuryResult.costBasisUsd)}
              />
              <StatCard
                label="Unrealized P/L"
                source={DataSource.MODELED}
                value={formatUsdCompact(treasuryResult.unrealizedPnlUsd)}
                hint={formatPercent(treasuryResult.unrealizedPnlPct)}
                tone={
                  treasuryResult.unrealizedPnlUsd >= 0
                    ? 'positive'
                    : 'negative'
                }
              />
              <StatCard
                label="Cash Reserve"
                source={DataSource.MANUAL}
                value={formatUsdCompact(treasuryResult.cashReserveUsd)}
              />
              <StatCard
                label="Hardware Book Value"
                source={DataSource.MANUAL}
                value={formatUsdCompact(
                  treasuryResult.minerHardwareBookValueUsd || hardwareBook,
                )}
              />
              <StatCard
                label="Forge NAV"
                source={DataSource.MODELED}
                value={formatUsdCompact(treasuryResult.forgeNavUsd)}
                tone="btc"
              />
              <StatCard
                label="BTC % of NAV"
                source={DataSource.MODELED}
                value={
                  treasuryResult.btcPctOfNav == null
                    ? '—'
                    : formatPercent(treasuryResult.btcPctOfNav, 0)
                }
              />
              <StatCard
                label="Hardware % of NAV"
                source={DataSource.MODELED}
                value={
                  treasuryResult.hardwarePctOfNav == null
                    ? '—'
                    : formatPercent(treasuryResult.hardwarePctOfNav, 0)
                }
              />
              <StatCard
                label="Cash % of NAV"
                source={DataSource.MODELED}
                value={
                  treasuryResult.cashPctOfNav == null
                    ? '—'
                    : formatPercent(treasuryResult.cashPctOfNav, 0)
                }
              />
              <StatCard
                label="BTC Mined (tracked)"
                source={DataSource.MANUAL}
                value={
                  treasury.btcMined > 0
                    ? formatBtc(treasury.btcMined)
                    : NOT_TRACKED
                }
              />
              <StatCard
                label="Long-term Target"
                source={DataSource.MANUAL}
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

        <Section id="fleet" title="Fleet operations">
          <FleetRegistry
            assets={assets}
            rows={rows}
            aggregate={aggregate}
            weightedEfficiencyJTh={weightedEfficiencyJTh}
            estimatedBtcPerDay={estimatedBtcPerDay}
            workers={pool.workers}
            demoMode={demoMode}
            defaultElectricityRate={energy.avgElectricityRatePerKwh}
            onDemoModeChange={changeDemoMode}
            onCreate={createAsset}
            onUpdate={updateAsset}
            onRemove={removeAsset}
            onToggleEnabled={toggleAsset}
          />
        </Section>

        <Section id="mining" title="Mining operations">
          <div className="grid grid--cards grid--compact mining-ops">
            <StatCard
              label="BTC Accumulated"
              source={DataSource.MANUAL}
              value={
                treasury.btcMined > 0
                  ? formatBtc(treasury.btcMined)
                  : aggregate.btcEarned30d != null
                    ? formatBtc(aggregate.btcEarned30d)
                    : NOT_TRACKED
              }
              hint={
                treasury.btcMined > 0
                  ? 'Manual treasury ledger'
                  : aggregate.btcEarned30d != null
                    ? 'Pool 30d rewards (proxy)'
                    : undefined
              }
              tone="btc"
            />
            <StatCard
              label="BTC / day"
              source={DataSource.MODELED}
              value={
                estimatedBtcPerDay > 0
                  ? formatBtc(estimatedBtcPerDay, 4)
                  : '—'
              }
            />
            <StatCard
              label="BTC / month"
              source={DataSource.MODELED}
              value={
                aggregate.estimatedMonthlyBtc > 0
                  ? formatBtc(aggregate.estimatedMonthlyBtc, 3)
                  : '—'
              }
            />
            <StatCard
              label="Sats / day"
              source={DataSource.MODELED}
              value={
                estimatedBtcPerDay > 0
                  ? formatNumber(Math.round(btcToSats(estimatedBtcPerDay)))
                  : '—'
              }
            />
            <StatCard
              label="Fleet PH/s"
              source={
                aggregate.currentHashrateTh > 0
                  ? DataSource.LIVE
                  : DataSource.MANUAL
              }
              value={`${thToPh(
                aggregate.currentHashrateTh || aggregate.expectedHashrateTh,
              ).toFixed(2)} PH/s`}
            />
            <StatCard
              label="Fleet Efficiency J/TH"
              source={DataSource.MANUAL}
              value={
                weightedEfficiencyJTh > 0
                  ? formatJTh(weightedEfficiencyJTh)
                  : '—'
              }
            />
            <StatCard
              label="Electricity Cost / month"
              source={DataSource.MODELED}
              value={formatUsdCompact(aggregate.operatingExpensesMonthlyUsd)}
              hint="Includes power (+ hosting when set)"
            />
            <StatCard
              label="Hosting Cost / month"
              source={DataSource.MANUAL}
              value={
                activeAssets.some((a) => (a.monthlyHostingFeeUsd ?? 0) > 0)
                  ? formatUsdCompact(
                      activeAssets.reduce(
                        (s, a) => s + (a.monthlyHostingFeeUsd ?? 0),
                        0,
                      ),
                    )
                  : NOT_TRACKED
              }
            />
            <StatCard
              label="Revenue / month"
              source={DataSource.MODELED}
              value={formatUsdCompact(aggregate.grossMiningRevenueMonthlyUsd)}
            />
            <StatCard
              label="Mining EBITDA"
              source={DataSource.MODELED}
              value={formatUsdCompact(aggregate.miningContributionMonthlyUsd)}
              tone={
                aggregate.miningContributionMonthlyUsd >= 0
                  ? 'positive'
                  : 'negative'
              }
            />
            <StatCard
              label="Cost to Mine 1 BTC"
              source={DataSource.MODELED}
              value={
                costPerBtc == null ? '—' : formatUsdCompact(costPerBtc)
              }
            />
            <StatCard
              label="Fleet Uptime"
              source={DataSource.MODELED}
              value={
                aggregate.fleetEfficiencyPct == null
                  ? NOT_TRACKED
                  : formatPercent(aggregate.fleetEfficiencyPct)
              }
              hint="Proxy: live hashrate / nominal"
            />
            <StatCard
              label="Miner ROI"
              source={DataSource.MODELED}
              value={
                fleetHardwareRoi == null
                  ? NOT_TRACKED
                  : formatPercent(fleetHardwareRoi, 0)
              }
              hint="Annualized · requires purchase cost"
            />
            <StatCard
              label="BTC-denominated ROI"
              source={DataSource.MODELED}
              value={
                hardwareBook > 0 &&
                market.btcPriceUsd > 0 &&
                aggregate.estimatedMonthlyBtc > 0
                  ? formatPercent(
                      (aggregate.estimatedMonthlyBtc * 12) /
                        (hardwareBook / market.btcPriceUsd),
                      0,
                    )
                  : NOT_TRACKED
              }
            />
          </div>

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
                <p className="eyebrow">MODELED / SCENARIO</p>
                <h3>Mining economics calculator</h3>
              </div>
              <span className="panel__meta">
                Forecast model only · not LIVE pool revenue
              </span>
            </div>
            <MiningCalculator />
          </div>
        </Section>

        <Section id="energy" title="Energy & infrastructure">
          <div className="grid grid--cards grid--compact">
            <StatCard
              label="Available Power"
              source={DataSource.MODELED}
              value={formatMw(energy.availableMw)}
              hint="Plan"
            />
            <StatCard
              label="Deployed Power"
              source={DataSource.MODELED}
              value={formatMw(energy.deployedMw)}
              hint="Plan"
            />
            <StatCard
              label="Avg Electricity Rate"
              source={DataSource.MANUAL}
              value={`$${energy.avgElectricityRatePerKwh.toFixed(3)}`}
              hint="per kWh"
            />
            <StatCard
              label="Registered Miner Load"
              source={DataSource.MANUAL}
              value={formatMw(minerLoadMw)}
            />
            <StatCard
              label="Infra Utilization"
              source={DataSource.MODELED}
              value={formatPercent(utilization, 0)}
              hint="deployed / available · plan"
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
          <div className="panel">
            <div className="panel__head">
              <h3>Infrastructure roadmap</h3>
              <span className="panel__meta">
                Anticipated modules · not built yet
              </span>
            </div>
            <div className="asset-grid">
              {infrastructureRoadmap.map((item) => (
                <div key={item.id} className="asset">
                  <div className="asset__top">
                    <span className="asset__name">{item.label}</span>
                    <AssetStatusBadge status={item.status} />
                  </div>
                  <p className="asset__note">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section id="capital" title="Capital allocation · plan">
          <div className="panel panel--center">
            <AllocationChart slices={[...capitalAllocation]} />
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
          v1.1 live operations · LIVE / MANUAL / MODELED
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
