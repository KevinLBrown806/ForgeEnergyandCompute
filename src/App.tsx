import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccumulationChart } from './components/AccumulationChart';
import { AllocationChart } from './components/AllocationChart';
import { DataManagement } from './components/DataManagement';
import { DataProvenancePanel } from './components/DataProvenancePanel';
import { FleetCapital } from './components/FleetCapital';
import { FleetRegistry } from './components/FleetRegistry';
import { MiningCalculator } from './components/MiningCalculator';
import { Nav } from './components/Nav';
import { OperationsExceptions } from './components/OperationsExceptions';
import { OperatorLogin } from './components/OperatorLogin';
import { StatCard } from './components/StatCard';
import { WorkersPanel } from './components/WorkersPanel';
import {
  createLocalDemoModeStore,
  createLocalFacilityRepository,
  createLocalFleetRepository,
  createLocalLiabilityRepository,
  createLocalOwnerSettingsRepository,
  createLocalTreasuryLedgerRepository,
  createLocalTreasuryRepository,
} from './adapters/localStorage';
import {
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
import {
  allocationFromPosition,
  DEFAULT_ALLOCATION_TARGETS,
  toChartSlices,
} from './domain/capital';
import { capitalRecoveryForFleet } from './domain/capitalRecovery';
import { DataSource } from './domain/dataSource';
import { buildFleetExceptions } from './domain/exceptions';
import { aggregateFacilities } from './domain/facilities';
import {
  aggregateFleet,
  buildFleetRows,
  isProductionEligible,
} from './domain/fleet';
import { aggregateFleetCapital } from './domain/ledger';
import { matchFleetWorkers } from './domain/matching';
import { buildOwnerKpis } from './domain/ownerKpis';
import type {
  CapitalAllocationTarget,
  Facility,
  FacilityInput,
  Liability,
  LiabilityInput,
  MinerAsset,
  MinerAssetInput,
  OwnerAssumptions,
  MiningSummaryResponse,
  TreasuryPosition,
  TreasuryTransaction,
  TreasuryTransactionInput,
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
  aggregateTreasuryLedger,
  ledgerByPeriod,
} from './lib/treasuryLedger';
import { computeNav } from './lib/nav';
import { computeUnitEconomics } from './lib/unitEconomics';
import {
  fetchAuthSession,
  fetchMiningSummary,
  loginOperator,
  logoutOperator,
  type AuthSession,
} from './services/forgeApi';
import {
  createForgeMarketProvider,
  createForgeNetworkProvider,
  createStubAccountingProvider,
  mergeMarketSnapshot,
  modeledMarketQuote,
  type MarketSnapshot,
} from './data/forgeData';
import { modeledNetworkSnapshot } from './data/providers/networkProvider';
import { DAYS_PER_MONTH } from './lib/estimator';

const fleetRepository = createLocalFleetRepository();
const treasuryRepository = createLocalTreasuryRepository();
const ledgerRepository = createLocalTreasuryLedgerRepository();
const facilityRepository = createLocalFacilityRepository();
const liabilityRepository = createLocalLiabilityRepository();
const settingsRepository = createLocalOwnerSettingsRepository();
const demoModeStore = createLocalDemoModeStore();
const marketProvider = createForgeMarketProvider();
const networkProvider = createForgeNetworkProvider();
const accountingProvider = createStubAccountingProvider();

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

const DEFAULT_ASSUMPTIONS: OwnerAssumptions = {
  poolFeePct: market.poolFeePct,
  uptimePct: market.uptimePct,
  defaultElectricityRatePerKwh: energy.avgElectricityRatePerKwh,
  efficiencyTargetJTh: null,
  monthlyAccumulationBtc: treasuryDefaults.monthlyAccumulationBtc,
  targetBtc: treasuryDefaults.targetBtc,
  otherAssetsUsd: 0,
  updatedAt: new Date(0).toISOString(),
};

const DEFAULT_MARKET: MarketSnapshot = mergeMarketSnapshot(
  modeledMarketQuote(),
  modeledNetworkSnapshot(),
);

function App() {
  const [storedAssets, setStoredAssets] = useState<MinerAsset[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [treasury, setTreasury] =
    useState<TreasuryPosition>(DEFAULT_TREASURY);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [assumptions, setAssumptions] =
    useState<OwnerAssumptions>(DEFAULT_ASSUMPTIONS);
  const [allocationTargets, setAllocationTargets] = useState<
    CapitalAllocationTarget[]
  >(DEFAULT_ALLOCATION_TARGETS);
  const [marketSnap, setMarketSnap] = useState<MarketSnapshot>(DEFAULT_MARKET);
  const [accountingConnected, setAccountingConnected] = useState(false);
  const [pool, setPool] = useState<MiningSummaryResponse>(EMPTY_SUMMARY);
  const [poolLoading, setPoolLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSession>(EMPTY_AUTH);
  const [btcPerThDay, setBtcPerThDay] = useState(0);

  const reloadFleet = useCallback(async () => {
    setStoredAssets(await fleetRepository.list());
  }, []);

  const reloadOwnerLedger = useCallback(async () => {
    const [assets, position, txs, facs, liabs, assum, targets] =
      await Promise.all([
        fleetRepository.list(),
        treasuryRepository.get(),
        ledgerRepository.list(),
        facilityRepository.list(),
        liabilityRepository.list(),
        settingsRepository.getAssumptions(),
        settingsRepository.getAllocationTargets(),
      ]);
    setStoredAssets(assets);
    setTreasury(position);
    setTransactions(txs);
    setFacilities(facs);
    setLiabilities(liabs);
    setAssumptions(assum);
    setAllocationTargets(targets);
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
      ledgerRepository.list(),
      facilityRepository.list(),
      liabilityRepository.list(),
      settingsRepository.getAssumptions(),
      settingsRepository.getAllocationTargets(),
      demoModeStore.isDemoMode(),
      marketProvider.getQuote(),
      networkProvider.getSnapshot(),
      accountingProvider.getSnapshot(),
    ]).then(
      ([
        assets,
        position,
        txs,
        facs,
        liabs,
        assum,
        targets,
        isDemo,
        quote,
        network,
        accounting,
      ]) => {
        if (controller.signal.aborted) return;
        setStoredAssets(assets);
        setTreasury(position);
        setTransactions(txs);
        setFacilities(facs);
        setLiabilities(liabs);
        setAssumptions(assum);
        setAllocationTargets(targets);
        setDemoMode(isDemo);
        const snap = mergeMarketSnapshot(quote, network);
        setMarketSnap(snap);
        setBtcPerThDay(snap.btcPerThPerDay);
        setAccountingConnected(accounting.connected);
      },
    );
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
  const operatingAssets = storedAssets;
  const rows = useMemo(
    () =>
      buildFleetRows({
        assets,
        workers: pool.workers,
        btcPerThPerDay: btcPerThDay,
        btcPriceUsd: marketSnap.btcPriceUsd,
        poolFeePct: assumptions.poolFeePct,
        defaultElectricityRatePerKwh: assumptions.defaultElectricityRatePerKwh,
      }),
    [
      assets,
      assumptions.defaultElectricityRatePerKwh,
      assumptions.poolFeePct,
      marketSnap.btcPriceUsd,
      pool.workers,
      btcPerThDay,
    ],
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
  const ownerRows = useMemo(
    () =>
      buildFleetRows({
        assets: operatingAssets,
        workers: pool.workers,
        btcPerThPerDay: btcPerThDay,
        btcPriceUsd: marketSnap.btcPriceUsd,
        poolFeePct: assumptions.poolFeePct,
        defaultElectricityRatePerKwh: assumptions.defaultElectricityRatePerKwh,
      }),
    [
      operatingAssets,
      assumptions.defaultElectricityRatePerKwh,
      assumptions.poolFeePct,
      marketSnap.btcPriceUsd,
      pool.workers,
      btcPerThDay,
    ],
  );
  const ownerAggregate = useMemo(
    () =>
      aggregateFleet({
        rows: ownerRows,
        rewards: pool.rewards,
        payouts: pool.payouts,
        unpaidBalanceBtc: pool.account?.currentBalanceBtc ?? null,
        btcEarnedToday: pool.account?.todayRewardBtc ?? null,
      }),
    [ownerRows, pool.account, pool.payouts, pool.rewards],
  );
  const exceptions = useMemo(
    () =>
      buildFleetExceptions({
        rows: ownerRows,
        workers: pool.workers,
        efficiencyTargetJTh: assumptions.efficiencyTargetJTh,
      }),
    [assumptions.efficiencyTargetJTh, ownerRows, pool.workers],
  );
  const matchReport = useMemo(
    () => matchFleetWorkers(assets, pool.workers),
    [assets, pool.workers],
  );
  const ledgerTotals = useMemo(
    () => aggregateTreasuryLedger(transactions),
    [transactions],
  );
  const periodSlices = useMemo(
    () => ledgerByPeriod(transactions),
    [transactions],
  );
  const hasLedger = transactions.length > 0;

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

  const effectiveTreasury: TreasuryPosition = hasLedger
    ? {
        ...treasury,
        btcHoldings: ledgerTotals.btcHoldings,
        avgAcquisitionPriceUsd: ledgerTotals.avgAcquisitionPriceUsd,
        btcMined: ledgerTotals.btcMined,
        btcPurchased: ledgerTotals.btcPurchased,
        btcSold: ledgerTotals.btcSold,
        btcTransferred: ledgerTotals.btcTransferred,
        btcCostBasisUsd: ledgerTotals.purchasedCostBasisUsd,
        cashReserveUsd: ledgerTotals.cashReserveUsd,
        monthlyAccumulationBtc: assumptions.monthlyAccumulationBtc,
        targetBtc: assumptions.targetBtc || treasury.targetBtc,
      }
    : treasury;

  const treasuryResult = computeTreasury({
    ...effectiveTreasury,
    btcPriceUsd: marketSnap.btcPriceUsd,
  });

  const capitalTotals = aggregateFleetCapital(
    operatingAssets,
    treasury.minerHardwareBookValueUsd,
  );
  const hardwareBook =
    capitalTotals.estimatedHardwareBookValueUsd ??
    treasury.minerHardwareBookValueUsd;
  const fleetHardwareRoi = simpleHardwareRoiAnnual(
    ownerAggregate.miningContributionMonthlyUsd,
    hardwareBook,
  );

  const costPerBtc = costToMineOneBtcUsd(
    ownerAggregate.operatingExpensesMonthlyUsd,
    ownerAggregate.estimatedMonthlyBtc,
  );

  /** BTC MTD: prefer LIVE pool rewards; otherwise MODELED estimate. */
  const btcMinedMtdLive = ownerAggregate.btcEarned30d;
  const btcMinedMtdModeled = ownerAggregate.estimatedMonthlyBtc;
  const hasLiveMtd = btcMinedMtdLive != null;

  const minerLoadMw = fleetPowerKw / 1000;
  const facilityAgg = aggregateFacilities(facilities, operatingAssets);
  const utilization =
    (facilityAgg.contractedMW || energy.availableMw) > 0
      ? (facilityAgg.deployedMW || energy.deployedMw) /
        (facilityAgg.contractedMW || energy.availableMw)
      : 0;

  const financingUsd = liabilities
    .filter((l) => l.kind === 'equipment_financing')
    .reduce((s, l) => s + l.amountUsd, 0);
  const hostingPayableUsd = liabilities
    .filter((l) => l.kind === 'hosting_payable')
    .reduce((s, l) => s + l.amountUsd, 0);
  const otherLiabUsd = liabilities
    .filter((l) => l.kind === 'other')
    .reduce((s, l) => s + l.amountUsd, 0);
  const liabilityTotal =
    liabilities.length > 0
      ? financingUsd + hostingPayableUsd + otherLiabUsd
      : effectiveTreasury.liabilitiesUsd;

  const nav = computeNav({
    btcHoldings: effectiveTreasury.btcHoldings,
    btcPriceUsd: marketSnap.btcPriceUsd,
    btcPriceSource: marketSnap.btcPriceSource,
    btcCostBasisUsd:
      effectiveTreasury.btcCostBasisUsd ??
      effectiveTreasury.btcHoldings * effectiveTreasury.avgAcquisitionPriceUsd,
    cashUsd: effectiveTreasury.cashReserveUsd,
    minerHardwareBookValueUsd: hardwareBook,
    otherAssetsUsd:
      assumptions.otherAssetsUsd || effectiveTreasury.otherAssetsUsd,
    equipmentFinancingUsd: financingUsd,
    hostingPayableUsd,
    otherLiabilitiesUsd:
      liabilities.length > 0 ? otherLiabUsd : effectiveTreasury.liabilitiesUsd,
    btcMinedLifetime: effectiveTreasury.btcMined,
    btcPurchasedLifetime: effectiveTreasury.btcPurchased,
  });

  const ownerKpis = buildOwnerKpis({
    navUsd: nav.netAssetValueUsd,
    btcHoldings: effectiveTreasury.btcHoldings,
    btcProduced: hasLiveMtd
      ? (btcMinedMtdLive as number)
      : effectiveTreasury.btcMined,
    btcProducedSource: hasLiveMtd
      ? DataSource.LIVE
      : effectiveTreasury.btcMined > 0
        ? DataSource.MANUAL
        : DataSource.MODELED,
    operatingHashrateTh:
      ownerAggregate.currentHashrateTh || ownerAggregate.expectedHashrateTh,
    hashrateSource:
      ownerAggregate.currentHashrateTh > 0 ? DataSource.LIVE : DataSource.MANUAL,
    miningRevenueUsd: ownerAggregate.grossMiningRevenueMonthlyUsd,
    miningOperatingCostUsd: ownerAggregate.operatingExpensesMonthlyUsd,
    fleetBookValueUsd: hardwareBook,
    deployedCapitalUsd: capitalTotals.totalDeployedCapitalUsd,
    btcPriceSource: marketSnap.btcPriceSource,
    networkSource: marketSnap.networkSource,
  });

  const allocation = allocationFromPosition(
    {
      bitcoinTreasuryUsd: nav.btcTreasuryMarketValueUsd,
      miningHardwareUsd: hardwareBook,
      energyInfrastructureUsd: 0,
      liquidityCashUsd: nav.cashUsd,
      otherUsd: nav.otherAssetsUsd,
    },
    allocationTargets,
  );
  const allocationSlices = toChartSlices(allocation);
  const recovery = capitalRecoveryForFleet(operatingAssets, transactions);
  const unitEconomics = assets.filter(isProductionEligible).map((asset) => ({
    asset,
    economics: computeUnitEconomics({
      quantity: asset.quantity,
      hashrateTh: asset.nominalHashrateTh,
      watts: asset.wattage,
      electricityRatePerKwh:
        asset.electricityRatePerKwh ?? assumptions.defaultElectricityRatePerKwh,
      hostingFeeUsdPerMonth: asset.monthlyHostingFeeUsd ?? 0,
      btcPriceUsd: marketSnap.btcPriceUsd,
      btcPerThPerDay: btcPerThDay,
      poolFeePct: assumptions.poolFeePct,
      uptimePct: assumptions.uptimePct,
      deployedCapitalUsd:
        (asset.acquisitionCostUsd ?? 0) * asset.quantity +
          (asset.shippingCostUsd ?? 0) +
          (asset.deploymentCostUsd ?? 0) || null,
    }),
  }));

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
  const appendTx = async (input: TreasuryTransactionInput) => {
    await ledgerRepository.append(input);
    await reloadOwnerLedger();
  };
  const removeTx = async (id: string) => {
    await ledgerRepository.remove(id);
    await reloadOwnerLedger();
  };
  const createFacility = async (input: FacilityInput) => {
    await facilityRepository.create(input);
    await reloadOwnerLedger();
  };
  const updateFacility = async (id: string, input: FacilityInput) => {
    await facilityRepository.update(id, input);
    await reloadOwnerLedger();
  };
  const removeFacility = async (id: string) => {
    await facilityRepository.remove(id);
    await reloadOwnerLedger();
  };
  const createLiability = async (input: LiabilityInput) => {
    await liabilityRepository.create(input);
    await reloadOwnerLedger();
  };
  const removeLiability = async (id: string) => {
    await liabilityRepository.remove(id);
    await reloadOwnerLedger();
  };
  const saveAssumptions = async (next: OwnerAssumptions) => {
    setAssumptions(await settingsRepository.saveAssumptions(next));
  };
  const saveAllocation = async (targets: CapitalAllocationTarget[]) => {
    setAllocationTargets(await settingsRepository.saveAllocationTargets(targets));
  };

  return (
    <div className="page">
      <Nav />

      <main>
        <section className="lede-row">
          <div>
            <p className="eyebrow">Forge OS v1.2 · Live data + owner ledger</p>
            <h1>Energy → Compute → Bitcoin → Treasury → Infrastructure</h1>
          </div>
          <p className="lede-row__note">
            Owner ledger + live market/network
            {demoMode ? ' · DEMO MODE' : ''}
            {marketSnap.btcPriceSource === DataSource.LIVE
              ? ` · BTC ${marketSnap.priceProvider}`
              : ' · BTC modeled'}
          </p>
        </section>

        <DataProvenancePanel
          metrics={[
            { label: 'Total NAV', ...nav.sourced.nav },
            { label: 'Mining Revenue', ...ownerKpis.miningRevenueUsd },
            {
              label: 'Mining Operating Profit',
              ...ownerKpis.miningOperatingProfitUsd,
            },
          ]}
        />

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
              label="Total NAV"
              source={ownerKpis.totalNav.source}
              dependencies={ownerKpis.totalNav.dependencies}
              value={formatUsdCompact(nav.netAssetValueUsd)}
              hint={
                nav.grossAssetsUsd > 0
                  ? `Assets ${formatUsdCompact(nav.grossAssetsUsd)}`
                  : 'Enter owner ledger figures to compute NAV'
              }
              tone="btc"
            />
            <StatCard
              label="BTC Treasury"
              source={ownerKpis.btcTreasuryQty.source}
              value={formatBtc(effectiveTreasury.btcHoldings)}
              hint={`Mkt ${formatUsdCompact(nav.btcTreasuryMarketValueUsd)}`}
              tone="btc"
            />
            <StatCard
              label="BTC Produced"
              source={ownerKpis.btcProduced.source}
              value={
                ownerKpis.btcProduced.value > 0
                  ? formatBtc(ownerKpis.btcProduced.value)
                  : NOT_TRACKED
              }
              hint={
                hasLiveMtd
                  ? 'Pool rewards · 30d'
                  : effectiveTreasury.btcMined > 0
                    ? 'Owner ledger'
                    : btcMinedMtdModeled > 0
                      ? 'Modeled from hashrate'
                      : 'No production history'
              }
              tone="btc"
            />
            <StatCard
              label="Operating Hashrate"
              source={ownerKpis.operatingHashrateTh.source}
              value={formatHashrate(ownerKpis.operatingHashrateTh.value)}
              hint={
                ownerAggregate.currentHashrateTh > 0
                  ? `${formatHashrate(ownerAggregate.expectedHashrateTh)} expected`
                  : 'Nominal from registry'
              }
            />
            <StatCard
              label="Mining Revenue"
              source={ownerKpis.miningRevenueUsd.source}
              dependencies={ownerKpis.miningRevenueUsd.dependencies}
              value={formatUsdCompact(ownerAggregate.grossMiningRevenueMonthlyUsd)}
              hint="Modeled monthly · not settled"
            />
            <StatCard
              label="Mining Operating Cost"
              source={ownerKpis.miningOperatingCostUsd.source}
              dependencies={ownerKpis.miningOperatingCostUsd.dependencies}
              value={formatUsdCompact(ownerAggregate.operatingExpensesMonthlyUsd)}
            />
            <StatCard
              label="Mining Operating Profit"
              source={ownerKpis.miningOperatingProfitUsd.source}
              dependencies={ownerKpis.miningOperatingProfitUsd.dependencies}
              value={formatUsdCompact(ownerAggregate.miningContributionMonthlyUsd)}
              hint="Modeled contribution · not settled P&amp;L"
              tone={
                ownerAggregate.miningContributionMonthlyUsd >= 0
                  ? 'positive'
                  : 'negative'
              }
            />
            <StatCard
              label="Fleet Book Value"
              source={ownerKpis.fleetBookValueUsd.source}
              value={
                hardwareBook > 0 ? formatUsdCompact(hardwareBook) : NOT_TRACKED
              }
            />
            <StatCard
              label="Deployed Capital"
              source={ownerKpis.deployedCapitalUsd.source}
              value={
                capitalTotals.totalDeployedCapitalUsd == null
                  ? NOT_TRACKED
                  : formatUsdCompact(capitalTotals.totalDeployedCapitalUsd)
              }
            />
            <StatCard
              label="Return on Deployed Capital"
              source={ownerKpis.returnOnDeployedMiningCapital.source}
              dependencies={ownerKpis.returnOnDeployedMiningCapital.dependencies}
              value={
                ownerKpis.returnOnDeployedMiningCapital.value == null
                  ? NOT_TRACKED
                  : formatPercent(ownerKpis.returnOnDeployedMiningCapital.value, 0)
              }
              hint="Annualized modeled profit / deployed capital"
            />
          </div>

          <div className="grid grid--cards grid--compact overview-secondary">
            <StatCard
              label="Online Miners"
              source={DataSource.LIVE}
              value={formatNumber(ownerAggregate.onlineMiners)}
              hint={`${ownerAggregate.degradedMiners} degraded · ${ownerAggregate.offlineMiners} offline`}
              tone={ownerAggregate.offlineMiners ? 'negative' : 'positive'}
            />
            <StatCard
              label="Registered Miners"
              source={DataSource.MANUAL}
              value={formatNumber(ownerAggregate.registeredMiners)}
              hint={`${ownerAggregate.enabledMiners} enabled`}
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
                ownerAggregate.fleetEfficiencyPct == null
                  ? '—'
                  : formatPercent(ownerAggregate.fleetEfficiencyPct)
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
            <OperationsExceptions exceptions={exceptions} />
          </div>
          {periodSlices.some((s) => s.available && s.period !== 'lifetime') && (
            <p className="panel__meta period-note">
              Ledger periods with data:{' '}
              {periodSlices
                .filter((s) => s.available)
                .map((s) => s.period)
                .join(' · ')}
            </p>
          )}
        </Section>

        <Section id="treasury" title="Bitcoin treasury / NAV">
          <div className="found-status">
            <span>Found Accounting</span>
            <span className="semantics semantics--manual">
              {accountingConnected ? 'CONNECTED' : 'NOT CONNECTED'}
            </span>
          </div>
          <div className="grid grid--cards grid--compact">
              <StatCard
                label="BTC Holdings"
                source={DataSource.MANUAL}
                value={formatBtc(effectiveTreasury.btcHoldings)}
                tone="btc"
              />
              <StatCard
                label="BTC Market Value"
                source={nav.sourced.btcMarketValue.source}
                dependencies={nav.sourced.btcMarketValue.dependencies}
                value={formatUsdCompact(nav.btcTreasuryMarketValueUsd)}
                hint={`@ ${formatUsd(marketSnap.btcPriceUsd)}${
                  marketSnap.priceUpdatedAt
                    ? ` · ${new Date(marketSnap.priceUpdatedAt).toLocaleString()}`
                    : ''
                }`}
              />
              <StatCard
                label="BTC Avg Cost Basis"
                source={DataSource.MANUAL}
                value={
                  nav.btcAverageCostBasisUsd > 0
                    ? formatUsd(nav.btcAverageCostBasisUsd)
                    : NOT_TRACKED
                }
                hint="Purchased BTC only · mined coins excluded"
              />
              <StatCard
                label="Unrealized P/L"
                source={nav.sourced.unrealizedPnl.source}
                dependencies={nav.sourced.unrealizedPnl.dependencies}
                value={formatUsdCompact(nav.btcUnrealizedPnlUsd)}
                hint={formatPercent(treasuryResult.unrealizedPnlPct)}
                tone={
                  nav.btcUnrealizedPnlUsd >= 0 ? 'positive' : 'negative'
                }
              />
              <StatCard
                label="Cash"
                source={DataSource.MANUAL}
                value={formatUsdCompact(nav.cashUsd)}
              />
              <StatCard
                label="Hardware Book Value"
                source={DataSource.MANUAL}
                value={formatUsdCompact(nav.minerHardwareBookValueUsd)}
              />
              <StatCard
                label="Other Assets"
                source={DataSource.MANUAL}
                value={formatUsdCompact(nav.otherAssetsUsd)}
              />
              <StatCard
                label="Gross Assets"
                source={DataSource.DERIVED}
                value={formatUsdCompact(nav.grossAssetsUsd)}
              />
              <StatCard
                label="Equipment Financing"
                source={DataSource.MANUAL}
                value={formatUsdCompact(nav.equipmentFinancingUsd)}
              />
              <StatCard
                label="Hosting Payable"
                source={DataSource.MANUAL}
                value={formatUsdCompact(nav.hostingPayableUsd)}
              />
              <StatCard
                label="Total Liabilities"
                source={DataSource.MANUAL}
                value={formatUsdCompact(nav.totalLiabilitiesUsd || liabilityTotal)}
              />
              <StatCard
                label="Net Asset Value"
                source={nav.sourced.nav.source}
                dependencies={nav.sourced.nav.dependencies}
                value={formatUsdCompact(nav.netAssetValueUsd)}
                tone="btc"
              />
              <StatCard
                label="BTC Produced Lifetime"
                source={DataSource.MANUAL}
                value={
                  nav.btcProducedLifetime > 0
                    ? formatBtc(nav.btcProducedLifetime)
                    : NOT_TRACKED
                }
              />
              <StatCard
                label="BTC Purchased Lifetime"
                source={DataSource.MANUAL}
                value={
                  nav.btcPurchasedLifetime > 0
                    ? formatBtc(nav.btcPurchasedLifetime)
                    : NOT_TRACKED
                }
              />
              <StatCard
                label="Long-term Target"
                source={DataSource.MANUAL}
                value={formatBtc(effectiveTreasury.targetBtc, 0)}
                hint={`${formatPercent(treasuryResult.progressToTargetPct, 0)} reached`}
              />
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
          {!demoMode && storedAssets.length === 0 && (
            <p className="notice">
              No Forge-owned miners are registered. Add miners in Data
              management or enable Demo mode to inspect placeholder equipment.
              Demo machines are never treated as owned inventory.
            </p>
          )}
          <div className="grid grid--cards grid--compact">
            <StatCard
              label="Registered miners"
              source={DataSource.MANUAL}
              value={formatNumber(matchReport.registeredMiners)}
            />
            <StatCard
              label="Braiins matched"
              source={DataSource.LIVE}
              value={formatNumber(matchReport.matchedWorkers)}
            />
            <StatCard
              label="Unmatched Forge miners"
              source={DataSource.DERIVED}
              value={formatNumber(matchReport.unmatchedForgeMiners.length)}
            />
            <StatCard
              label="Unmatched Braiins workers"
              source={DataSource.LIVE}
              value={formatNumber(matchReport.unmatchedBraiinsWorkers.length)}
            />
          </div>
          <FleetRegistry
            assets={assets}
            rows={rows}
            aggregate={aggregate}
            weightedEfficiencyJTh={weightedEfficiencyJTh}
            estimatedBtcPerDay={estimatedBtcPerDay}
            workers={pool.workers}
            demoMode={demoMode}
            defaultElectricityRate={assumptions.defaultElectricityRatePerKwh}
            onDemoModeChange={changeDemoMode}
            onCreate={createAsset}
            onUpdate={updateAsset}
            onRemove={removeAsset}
            onToggleEnabled={toggleAsset}
          />
          <FleetCapital
            totals={capitalTotals}
            assets={demoMode ? assets : operatingAssets}
            recovery={recovery}
            demoMode={demoMode}
          />
        </Section>

        <Section id="mining" title="Mining operations">
          <div className="grid grid--cards grid--compact mining-ops">
            <StatCard
              label="BTC Accumulated"
              source={DataSource.MANUAL}
              value={
                effectiveTreasury.btcMined > 0
                  ? formatBtc(effectiveTreasury.btcMined)
                  : aggregate.btcEarned30d != null
                    ? formatBtc(aggregate.btcEarned30d)
                    : NOT_TRACKED
              }
              hint={
                effectiveTreasury.btcMined > 0
                  ? 'Owner ledger'
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
                marketSnap.btcPriceUsd > 0 &&
                aggregate.estimatedMonthlyBtc > 0
                  ? formatPercent(
                      (aggregate.estimatedMonthlyBtc * 12) /
                        (hardwareBook / marketSnap.btcPriceUsd),
                      0,
                    )
                  : NOT_TRACKED
              }
            />
          </div>

          <div className="grid grid--cards grid--compact">
            <StatCard
              label="Network Hashrate"
              source={marketSnap.networkSource}
              value={`${marketSnap.networkHashrateEhs.toFixed(1)} EH/s`}
              hint={
                marketSnap.fetchedAt
                  ? `Updated ${new Date(marketSnap.fetchedAt).toLocaleString()}`
                  : 'MODELED assumption'
              }
            />
            <StatCard
              label="Difficulty"
              source={marketSnap.networkSource}
              value={
                marketSnap.difficulty == null
                  ? NOT_TRACKED
                  : formatNumber(marketSnap.difficulty)
              }
            />
            <StatCard
              label="Block Height"
              source={marketSnap.networkSource}
              value={
                marketSnap.blockHeight == null
                  ? NOT_TRACKED
                  : formatNumber(marketSnap.blockHeight)
              }
            />
            <StatCard
              label="Block Subsidy"
              source={
                marketSnap.blockHeight != null
                  ? DataSource.DERIVED
                  : DataSource.MODELED
              }
              value={formatBtc(marketSnap.blockSubsidyBtc, 3)}
            />
            <StatCard
              label="Days to Adjustment"
              source={marketSnap.networkSource}
              value={
                marketSnap.daysUntilAdjustment == null
                  ? NOT_TRACKED
                  : `${marketSnap.daysUntilAdjustment.toFixed(1)}d`
              }
              hint={
                marketSnap.nextDifficultyChangePct == null
                  ? undefined
                  : `${marketSnap.nextDifficultyChangePct.toFixed(2)}% est.`
              }
            />
            <StatCard
              label="BTC Spot"
              source={marketSnap.btcPriceSource}
              value={formatUsd(marketSnap.btcPriceUsd)}
              hint={
                marketSnap.change24hPct == null
                  ? marketSnap.priceProvider
                  : `${marketSnap.change24hPct >= 0 ? '+' : ''}${marketSnap.change24hPct.toFixed(2)}% 24h · ${marketSnap.priceProvider}`
              }
              tone="btc"
            />
          </div>
          {unitEconomics.length > 0 && (
            <div className="panel panel--table">
              <div className="panel__head panel__head--padded">
                <div>
                  <h3>Miner unit economics</h3>
                  <span className="panel__meta">MODELED · live market/network when available</span>
                </div>
              </div>
              <div className="table-wrap">
                <table className="fleet-table">
                  <thead>
                    <tr>
                      <th>Miner</th>
                      <th className="num">BTC/day</th>
                      <th className="num">Rev/day</th>
                      <th className="num">Power/day</th>
                      <th className="num">Host/day</th>
                      <th className="num">Margin</th>
                      <th className="num">BE BTC</th>
                      <th className="num">BE $/kWh</th>
                      <th className="num">Payback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitEconomics.map(({ asset, economics }) => (
                      <tr key={asset.id}>
                        <td>
                          {asset.model}
                          <span className="cell-sub">{asset.serialNumber}</span>
                        </td>
                        <td className="num">{formatBtc(economics.expectedBtcPerDay, 4)}</td>
                        <td className="num">{formatUsdCompact(economics.usdRevenuePerDay)}</td>
                        <td className="num">{formatUsdCompact(economics.electricityPerDay)}</td>
                        <td className="num">{formatUsdCompact(economics.hostingPerDay)}</td>
                        <td className="num">{formatPercent(economics.miningMarginPct)}</td>
                        <td className="num">{formatUsdCompact(economics.breakevenBtcPrice)}</td>
                        <td className="num">
                          {economics.breakevenElectricityRate == null
                            ? '—'
                            : `$${economics.breakevenElectricityRate.toFixed(3)}`}
                        </td>
                        <td className="num">
                          {economics.estimatedHardwarePaybackMonths == null
                            ? '—'
                            : `${economics.estimatedHardwarePaybackMonths.toFixed(1)} mo`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
              source={facilities.length ? DataSource.MANUAL : DataSource.MODELED}
              value={formatMw(facilityAgg.contractedMW || energy.availableMw)}
              hint={facilities.length ? 'Facility ledger' : 'Plan'}
            />
            <StatCard
              label="Deployed Power"
              source={facilities.length ? DataSource.MANUAL : DataSource.MODELED}
              value={formatMw(facilityAgg.deployedMW || energy.deployedMw)}
              hint={facilities.length ? 'Facility ledger' : 'Plan'}
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

        <Section id="capital" title="Capital allocation">
          <div className="panel">
            <div className="panel__head">
              <h3>Current vs target</h3>
              <span className="panel__meta">
                Current from Forge asset values · targets MANUAL
              </span>
            </div>
            <div className="split">
              <AllocationChart slices={allocationSlices} />
              <table className="fleet-table">
                <thead>
                  <tr>
                    <th>Bucket</th>
                    <th className="num">Current</th>
                    <th className="num">Share</th>
                    <th className="num">Target</th>
                    <th className="num">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {allocation.map((row) => (
                    <tr key={row.bucket}>
                      <td>{row.label}</td>
                      <td className="num">{formatUsdCompact(row.currentUsd)}</td>
                      <td className="num">
                        {row.currentPct == null ? '—' : formatPercent(row.currentPct, 0)}
                      </td>
                      <td className="num">
                        {row.targetPct == null ? '—' : formatPercent(row.targetPct, 0)}
                      </td>
                      <td className="num">
                        {row.variancePct == null
                          ? '—'
                          : formatPercent(row.variancePct, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

        <Section id="data" title="Data management">
          <DataManagement
            demoMode={demoMode}
            assets={operatingAssets}
            workers={pool.workers}
            transactions={transactions}
            facilities={facilities}
            liabilities={liabilities}
            assumptions={assumptions}
            allocationTargets={allocationTargets}
            treasury={treasury}
            onCreateAsset={createAsset}
            onUpdateAsset={updateAsset}
            onRemoveAsset={removeAsset}
            onAppendTx={appendTx}
            onRemoveTx={removeTx}
            onCreateFacility={createFacility}
            onUpdateFacility={updateFacility}
            onRemoveFacility={removeFacility}
            onCreateLiability={createLiability}
            onRemoveLiability={removeLiability}
            onSaveAssumptions={saveAssumptions}
            onSaveAllocation={saveAllocation}
            onSaveTreasury={saveTreasury}
          />
        </Section>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Forge Energy &amp; Compute</span>
        <span className="footer__note">
          v1.2 live data + owner ledger · LIVE / MANUAL / MODELED / DERIVED
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
