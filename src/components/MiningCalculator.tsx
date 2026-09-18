import { useMemo, useState } from 'react';
import { energy, market } from '../config/forge.config';
import { btcPerThPerDay, computeMining } from '../lib/mining';
import {
  formatBtc,
  formatHashrate,
  formatJTh,
  formatNumber,
  formatPercent,
  formatTonnes,
  formatUsd,
  formatUsdCompact,
} from '../lib/format';

interface CalcState {
  minerCount: number;
  hashratePerMinerTh: number;
  wattsPerMiner: number;
  electricityRatePerKwh: number;
  btcPriceUsd: number;
  networkHashrateEhs: number;
  poolFeePct: number;
  uptimePct: number;
}

interface Field {
  key: keyof CalcState;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const FIELDS: Field[] = [
  { key: 'minerCount', label: 'Miner count', min: 10, max: 5000, step: 10, format: (v) => formatNumber(v) },
  { key: 'hashratePerMinerTh', label: 'Hashrate / miner', min: 50, max: 400, step: 1, format: (v) => `${v} TH/s` },
  { key: 'wattsPerMiner', label: 'Power / miner', min: 1000, max: 6000, step: 10, format: (v) => `${formatNumber(v)} W` },
  { key: 'electricityRatePerKwh', label: 'Electricity rate', min: 0.02, max: 0.15, step: 0.001, format: (v) => `$${v.toFixed(3)}/kWh` },
  { key: 'btcPriceUsd', label: 'BTC price', min: 20000, max: 150000, step: 1000, format: (v) => formatUsd(v) },
  { key: 'networkHashrateEhs', label: 'Network hashrate', min: 300, max: 1200, step: 10, format: (v) => `${formatNumber(v)} EH/s` },
  { key: 'poolFeePct', label: 'Pool fee', min: 0, max: 0.05, step: 0.001, format: (v) => formatPercent(v, 1) },
  { key: 'uptimePct', label: 'Uptime', min: 0.8, max: 1, step: 0.005, format: (v) => formatPercent(v, 1) },
];

const DEFAULTS: CalcState = {
  minerCount: 600,
  hashratePerMinerTh: 200,
  wattsPerMiner: 3500,
  electricityRatePerKwh: energy.avgElectricityRatePerKwh,
  btcPriceUsd: market.btcPriceUsd,
  networkHashrateEhs: market.network.networkHashrateEhs,
  poolFeePct: market.poolFeePct,
  uptimePct: market.uptimePct,
};

export function MiningCalculator() {
  const [state, setState] = useState<CalcState>(DEFAULTS);

  const result = useMemo(() => {
    const production = btcPerThPerDay({
      networkHashrateEhs: state.networkHashrateEhs,
      blockRewardBtc: market.network.blockRewardBtc,
      blocksPerDay: market.network.blocksPerDay,
    });
    return computeMining({
      minerCount: state.minerCount,
      hashratePerMinerTh: state.hashratePerMinerTh,
      wattsPerMiner: state.wattsPerMiner,
      electricityRatePerKwh: state.electricityRatePerKwh,
      btcPriceUsd: state.btcPriceUsd,
      btcPerThPerDay: production,
      poolFeePct: state.poolFeePct,
      uptimePct: state.uptimePct,
      carbonKgPerKwh: market.carbonKgPerKwh,
    });
  }, [state]);

  const update = (key: keyof CalcState, value: number) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const cashflowPositive = result.monthlyGrossProfit >= 0;

  return (
    <div className="calc">
      <div className="calc__controls">
        {FIELDS.map((field) => (
          <label key={field.key} className="control">
            <span className="control__label">
              {field.label}
              <output className="control__value">{field.format(state[field.key])}</output>
            </span>
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={state[field.key]}
              aria-label={field.label}
              onChange={(e) => update(field.key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <div className="calc__results" role="status" aria-live="polite">
        <Result label="Total hashrate" value={formatHashrate(result.totalHashrateTh)} sub={formatJTh(result.fleetEfficiencyJPerTh)} />
        <Result label="Energy / month" value={`${formatNumber(result.monthlyKwh / 1000)} MWh`} sub={`${formatNumber(result.totalPowerKw)} kW load`} />
        <Result label="Power cost / month" value={formatUsd(result.monthlyPowerCost)} />
        <Result label="BTC mined / month" value={formatBtc(result.btcMinedPerMonth, 3)} tone="btc" />
        <Result label="Revenue / month" value={formatUsdCompact(result.monthlyRevenue)} />
        <Result label="Gross profit / month" value={formatUsdCompact(result.monthlyGrossProfit)} tone={cashflowPositive ? 'positive' : 'negative'} />
        <Result label="Mining margin" value={formatPercent(result.miningMarginPct)} tone={cashflowPositive ? 'positive' : 'negative'} />
        <Result label="Breakeven BTC price" value={formatUsd(result.breakevenBtcPrice)} sub={`${formatTonnes(result.monthlyCo2Tonnes)} CO₂ / mo`} />
      </div>
    </div>
  );
}

function Result({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'btc' | 'positive' | 'negative';
}) {
  return (
    <div className={`result result--${tone}`}>
      <p className="result__label">{label}</p>
      <p className="result__value">{value}</p>
      {sub && <p className="result__sub">{sub}</p>}
    </div>
  );
}
