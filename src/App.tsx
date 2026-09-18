import { Nav } from './components/Nav';
import { StatCard } from './components/StatCard';
import { AccumulationChart } from './components/AccumulationChart';
import { AllocationChart } from './components/AllocationChart';
import { MiningCalculator } from './components/MiningCalculator';
import {
  capitalAllocation,
  energy,
  fleet,
  flywheel,
  market,
  roadmap,
  treasury,
  type AssetStatus,
  type MinerStatus,
  type RoadmapStatus,
} from './config/forge.config';
import {
  btcPerThPerDay,
  computeMinerEconomics,
  summarizeFleet,
  type FleetContext,
} from './lib/mining';
import { computeTreasury } from './lib/treasury';
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

const production = btcPerThPerDay(market.network);

const fleetCtx: FleetContext = {
  btcPriceUsd: market.btcPriceUsd,
  btcPerThPerDay: production,
  poolFeePct: market.poolFeePct,
  uptimePct: market.uptimePct,
  electricityRatePerKwh: energy.avgElectricityRatePerKwh,
  carbonKgPerKwh: market.carbonKgPerKwh,
};

function App() {
  const summary = summarizeFleet(fleet, fleetCtx);
  const treasuryResult = computeTreasury({
    btcHoldings: treasury.btcHoldings,
    avgAcquisitionPriceUsd: treasury.avgAcquisitionPriceUsd,
    btcPriceUsd: market.btcPriceUsd,
    monthlyAccumulationBtc: treasury.monthlyAccumulationBtc,
    targetBtc: treasury.targetBtc,
  });
  const minerLines = fleet.map((m) => computeMinerEconomics(m, fleetCtx));
  const minerLoadMw = summary.activePowerKw / 1000;
  const utilization =
    energy.availableMw > 0 ? energy.deployedMw / energy.availableMw : 0;
  const cashPositive = summary.monthlyCashFlow >= 0;
  const gainPositive = treasuryResult.unrealizedPnlUsd >= 0;

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
            Private mining &amp; energy command center · figures from mock data
          </p>
        </section>

        {/* Overview */}
        <Section id="overview" title="Executive overview">
          <div className="grid grid--cards">
            <StatCard
              label="Bitcoin Treasury"
              value={formatBtc(treasury.btcHoldings)}
              hint={`Target ${formatBtc(treasury.targetBtc, 0)}`}
              tone="btc"
            />
            <StatCard label="BTC Price" value={formatUsd(market.btcPriceUsd)} />
            <StatCard
              label="Treasury Value"
              value={formatUsdCompact(treasuryResult.currentValueUsd)}
            />
            <StatCard
              label="Miner Fleet"
              value={formatNumber(summary.totalMiners)}
              hint={`${fleet.length} models`}
            />
            <StatCard
              label="Active Miners"
              value={formatNumber(summary.activeMiners)}
              hint={`${formatPercent(summary.activeMiners / summary.totalMiners, 0)} online`}
            />
            <StatCard
              label="Total Hashrate"
              value={formatHashrate(summary.activeHashrateTh)}
            />
            <StatCard
              label="Avg Fleet Efficiency"
              value={formatJTh(summary.avgEfficiencyJPerTh)}
            />
            <StatCard
              label="Power Capacity"
              value={formatMw(energy.availableMw)}
              hint={`${formatMw(energy.deployedMw)} deployed`}
            />
            <StatCard
              label="Electricity Cost"
              value={`$${energy.avgElectricityRatePerKwh.toFixed(3)}`}
              hint="per kWh"
            />
            <StatCard
              label="Est. BTC Mined / mo"
              value={formatBtc(summary.btcMinedPerMonth, 2)}
              tone="btc"
            />
            <StatCard
              label="Mining Revenue / mo"
              value={formatUsdCompact(summary.monthlyRevenue)}
            />
            <StatCard
              label="Mining Op Cost / mo"
              value={formatUsdCompact(summary.monthlyOperatingCost)}
            />
            <StatCard
              label="Mining Cash Flow / mo"
              value={formatUsdCompact(summary.monthlyCashFlow)}
              tone={cashPositive ? 'positive' : 'negative'}
            />
            <StatCard
              label="Breakeven BTC Price"
              value={formatUsd(summary.breakevenBtcPrice)}
            />
          </div>
        </Section>

        {/* Treasury */}
        <Section id="treasury" title="Bitcoin treasury">
          <div className="split">
            <div className="grid grid--cards grid--compact">
              <StatCard label="BTC Holdings" value={formatBtc(treasury.btcHoldings)} tone="btc" />
              <StatCard label="Avg Acquisition" value={formatUsd(treasury.avgAcquisitionPriceUsd)} />
              <StatCard label="Current Value" value={formatUsdCompact(treasuryResult.currentValueUsd)} />
              <StatCard
                label="Unrealized P/L"
                value={formatUsdCompact(treasuryResult.unrealizedPnlUsd)}
                hint={formatPercent(treasuryResult.unrealizedPnlPct)}
                tone={gainPositive ? 'positive' : 'negative'}
              />
              <StatCard label="Monthly Accumulation" value={formatBtc(treasury.monthlyAccumulationBtc)} />
              <StatCard label="Annual Accumulation" value={formatBtc(treasuryResult.annualAccumulationBtc)} />
              <StatCard
                label="Long-term Target"
                value={formatBtc(treasury.targetBtc, 0)}
                hint={`${formatPercent(treasuryResult.progressToTargetPct, 0)} reached`}
              />
              <StatCard
                label="Cost Basis"
                value={formatUsdCompact(treasuryResult.costBasisUsd)}
              />
            </div>
            <div className="panel">
              <div className="panel__head">
                <h3>BTC accumulation</h3>
                <span className="panel__meta">Cumulative holdings · target {formatBtc(treasury.targetBtc, 0)}</span>
              </div>
              <AccumulationChart data={[...treasury.accumulationHistory]} targetBtc={treasury.targetBtc} />
            </div>
          </div>
        </Section>

        {/* Mining */}
        <Section id="mining" title="Mining fleet">
          <div className="panel panel--table">
            <div className="table-wrap">
              <table className="fleet-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th className="num">Qty</th>
                    <th className="num">Hashrate</th>
                    <th className="num">Watts</th>
                    <th className="num">J/TH</th>
                    <th className="num">Elec / day</th>
                    <th className="num">BTC / mo</th>
                    <th className="num">Revenue / mo</th>
                    <th className="num">Margin</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {minerLines.map((line) => (
                    <tr key={line.miner.id} className={line.active ? '' : 'row--muted'}>
                      <td>{line.miner.model}</td>
                      <td className="num">{formatNumber(line.miner.quantity)}</td>
                      <td className="num">{formatHashrate(line.totalHashrateTh)}</td>
                      <td className="num">{formatNumber(line.miner.watts)}</td>
                      <td className="num">{formatJTh(line.efficiencyJPerTh)}</td>
                      <td className="num">{formatUsd(line.electricityCostPerDay)}</td>
                      <td className="num">{line.active ? formatBtc(line.btcPerMonth, 2) : '—'}</td>
                      <td className="num">{line.active ? formatUsdCompact(line.monthlyRevenue) : '—'}</td>
                      <td className="num">{line.active ? formatPercent(line.operatingMarginPct) : '—'}</td>
                      <td>
                        <MinerStatusBadge status={line.miner.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h3>Mining economics calculator</h3>
              <span className="panel__meta">Adjust assumptions · results update live</span>
            </div>
            <MiningCalculator />
          </div>
        </Section>

        {/* Energy */}
        <Section id="energy" title="Energy & infrastructure">
          <div className="grid grid--cards grid--compact">
            <StatCard label="Available Power" value={formatMw(energy.availableMw)} />
            <StatCard label="Deployed Power" value={formatMw(energy.deployedMw)} />
            <StatCard label="Avg Electricity Rate" value={`$${energy.avgElectricityRatePerKwh.toFixed(3)}`} hint="per kWh" />
            <StatCard label="Miner Load" value={formatMw(minerLoadMw)} />
            <StatCard label="Infra Utilization" value={formatPercent(utilization, 0)} hint="deployed / available" />
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

        {/* Capital */}
        <Section id="capital" title="Capital allocation">
          <div className="panel panel--center">
            <AllocationChart slices={capitalAllocation} />
          </div>
        </Section>

        {/* Strategy */}
        <Section id="strategy" title="Strategy & roadmap">
          <div className="split split--strategy">
            <div className="panel">
              <div className="panel__head">
                <h3>The Forge flywheel</h3>
              </div>
              <ol className="flywheel">
                {flywheel.map((step, i) => (
                  <li key={step} className="flywheel__step">
                    <span className="flywheel__num">{i + 1}</span>
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
        <span className="footer__note">v1 operating dashboard · mock data</span>
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
  children: React.ReactNode;
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

const MINER_STATUS_LABEL: Record<MinerStatus, string> = {
  online: 'Online',
  provisioning: 'Provisioning',
  offline: 'Offline',
};

function MinerStatusBadge({ status }: { status: MinerStatus }) {
  return <span className={`badge badge--${status}`}>{MINER_STATUS_LABEL[status]}</span>;
}

const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  active: 'Active',
  planned: 'Planned',
  exploring: 'Exploring',
};

function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return <span className={`badge badge--${status}`}>{ASSET_STATUS_LABEL[status]}</span>;
}

const ROADMAP_STATUS_LABEL: Record<RoadmapStatus, string> = {
  done: 'Done',
  in_progress: 'In progress',
  planned: 'Planned',
};

function RoadmapDot({ status }: { status: RoadmapStatus }) {
  return <span className={`roadmap__dot roadmap__dot--${status}`} aria-hidden="true" />;
}

function RoadmapStatusLabel({ status }: { status: RoadmapStatus }) {
  return <span className={`roadmap__status roadmap__status--${status}`}>{ROADMAP_STATUS_LABEL[status]}</span>;
}

export default App;
