import { useMemo, useState } from 'react';
import {
  efficiencyJTh,
  isProductionEligible,
} from '../domain/fleet';
import type {
  FleetAggregate,
  FleetRow,
  MinerAsset,
  MinerAssetInput,
  PoolWorker,
} from '../domain/types';
import { MINER_ASSET_STATUS_LABEL } from '../domain/types';
import {
  formatBtc,
  formatHashrate,
  formatJTh,
  formatNumber,
  formatPercent,
  formatPowerKw,
  formatUsdCompact,
} from '../lib/format';
import {
  btcDenominatedRoiAnnual,
  simpleHardwareRoiAnnual,
} from '../lib/mining';
import { MinerForm } from './MinerForm';

interface FleetRegistryProps {
  assets: MinerAsset[];
  rows: FleetRow[];
  aggregate: FleetAggregate;
  /** Weighted J/TH from active assets (from mining engine). */
  weightedEfficiencyJTh: number;
  /** Estimated BTC/day from live economics aggregate. */
  estimatedBtcPerDay: number;
  workers: PoolWorker[];
  demoMode: boolean;
  defaultElectricityRate: number;
  onDemoModeChange: (enabled: boolean) => Promise<void>;
  onCreate: (input: MinerAssetInput) => Promise<void>;
  onUpdate: (id: string, input: MinerAssetInput) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onToggleEnabled: (asset: MinerAsset) => Promise<void>;
}

function rowRoi(row: FleetRow): number | null {
  const cost = row.asset.acquisitionCostUsd;
  if (cost == null || cost <= 0) return null;
  const purchase = cost * row.asset.quantity;
  return simpleHardwareRoiAnnual(
    row.economics.netContributionPerMonthUsd,
    purchase,
  );
}

function rowBtcRoi(row: FleetRow, btcPriceUsd: number): number | null {
  const cost = row.asset.acquisitionCostUsd;
  if (cost == null || cost <= 0) return null;
  return btcDenominatedRoiAnnual(
    row.economics.btcPerDay * 30.4375,
    cost * row.asset.quantity,
    btcPriceUsd,
  );
}

export function FleetRegistry(props: FleetRegistryProps) {
  const [editing, setEditing] = useState<MinerAsset | 'new' | null>(null);
  const btcPriceUsd = useMemo(() => {
    const rev = props.rows.reduce(
      (s, r) => s + r.economics.estimatedRevenuePerDayUsd,
      0,
    );
    const btc = props.rows.reduce((s, r) => s + r.economics.btcPerDay, 0);
    return btc > 0 ? rev / btc : 0;
  }, [props.rows]);

  const save = async (input: MinerAssetInput) => {
    if (editing === 'new') await props.onCreate(input);
    else if (editing) await props.onUpdate(editing.id, input);
    setEditing(null);
  };

  const totals = props.aggregate;

  return (
    <>
      <div className="panel registry-toolbar">
        <div>
          <h3>Fleet operations</h3>
          <p className="panel__meta">
            Inventory is stored in this browser. Economics from the mining
            engine · pool telemetry is read-only.
          </p>
        </div>
        <div className="toolbar-actions">
          <label className="check">
            <input
              type="checkbox"
              checked={props.demoMode}
              onChange={(event) => {
                void props.onDemoModeChange(event.target.checked);
                setEditing(null);
              }}
            />
            Demo mode
          </label>
          <button
            className="button button--primary"
            type="button"
            disabled={props.demoMode}
            onClick={() => setEditing('new')}
          >
            + Add Miner
          </button>
        </div>
      </div>

      {props.demoMode && (
        <p className="notice">
          Demo mode uses illustrative sample assets and never writes them to the
          operating registry. Replace with real Forge miners via + Add Miner.
        </p>
      )}

      {editing && !props.demoMode && (
        <div className="panel">
          <div className="panel__head">
            <h3>{editing === 'new' ? 'Add miner' : 'Edit miner'}</h3>
            <span className="panel__meta">Inventory record · MANUAL</span>
          </div>
          <MinerForm
            key={editing === 'new' ? 'new' : editing.id}
            asset={editing === 'new' ? undefined : editing}
            workers={props.workers}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      <div className="grid grid--cards grid--compact fleet-totals">
        <div className="stat-card">
          <p className="stat-card__label">Total Machines</p>
          <p className="stat-card__value">
            {formatNumber(totals.registeredMiners)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Online Machines</p>
          <p className="stat-card__value">
            {formatNumber(totals.onlineMiners)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Fleet Hashrate</p>
          <p className="stat-card__value">
            {formatHashrate(totals.currentHashrateTh || totals.expectedHashrateTh)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Fleet Power Draw</p>
          <p className="stat-card__value">
            {formatPowerKw(
              props.assets
                .filter(isProductionEligible)
                .reduce((s, a) => s + a.quantity * a.wattage, 0) / 1000,
            )}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Weighted Efficiency</p>
          <p className="stat-card__value">
            {props.weightedEfficiencyJTh > 0
              ? formatJTh(props.weightedEfficiencyJTh)
              : '—'}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Est. BTC / day</p>
          <p className="stat-card__value">
            {formatBtc(props.estimatedBtcPerDay, 4)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Est. BTC / month</p>
          <p className="stat-card__value">
            {formatBtc(totals.estimatedMonthlyBtc, 3)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Est. Revenue / month</p>
          <p className="stat-card__value">
            {formatUsdCompact(totals.grossMiningRevenueMonthlyUsd)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Est. Op Cost / month</p>
          <p className="stat-card__value">
            {formatUsdCompact(totals.operatingExpensesMonthlyUsd)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Est. Mining EBITDA / month</p>
          <p className="stat-card__value">
            {formatUsdCompact(totals.miningContributionMonthlyUsd)}
          </p>
        </div>
      </div>

      <div className="panel panel--table">
        <div className="table-wrap">
          <table className="fleet-table">
            <thead>
              <tr>
                <th>Miner</th>
                <th className="num">Qty</th>
                <th>Location</th>
                <th className="num">Hashrate</th>
                <th className="num">J/TH</th>
                <th className="num">Power</th>
                <th className="num">$/kWh</th>
                <th className="num">BTC/mo</th>
                <th className="num">Revenue/mo</th>
                <th className="num">Cost/mo</th>
                <th className="num">Profit/mo</th>
                <th className="num">ROI</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => {
                const rate =
                  row.asset.electricityRatePerKwh ??
                  props.defaultElectricityRate;
                const hashrateTh =
                  row.live24hTh ??
                  (isProductionEligible(row.asset)
                    ? row.expectedHashrateTh
                    : 0);
                const powerKw =
                  (row.asset.quantity * row.asset.wattage) / 1000;
                const roi = rowRoi(row);
                const btcRoi =
                  btcPriceUsd > 0 ? rowBtcRoi(row, btcPriceUsd) : null;
                const statusLabel = isProductionEligible(row.asset)
                  ? row.health
                  : MINER_ASSET_STATUS_LABEL[row.asset.status];
                const statusClass = isProductionEligible(row.asset)
                  ? row.health.toLowerCase()
                  : row.asset.status;

                return (
                  <tr
                    key={row.asset.id}
                    className={row.asset.enabled ? '' : 'row--muted'}
                  >
                    <td>
                      {row.asset.manufacturer
                        ? `${row.asset.manufacturer} `
                        : ''}
                      {row.asset.model}
                      <span className="cell-sub">{row.asset.serialNumber}</span>
                    </td>
                    <td className="num">{formatNumber(row.asset.quantity)}</td>
                    <td>
                      {row.asset.facility || '—'}
                      {row.asset.hostingProvider ? (
                        <span className="cell-sub">
                          {row.asset.hostingProvider}
                        </span>
                      ) : null}
                    </td>
                    <td className="num">
                      {hashrateTh > 0 ? formatHashrate(hashrateTh) : '—'}
                    </td>
                    <td className="num">{formatJTh(efficiencyJTh(row.asset))}</td>
                    <td className="num">{formatPowerKw(powerKw)}</td>
                    <td className="num">${rate.toFixed(3)}</td>
                    <td className="num">
                      {row.economics.btcPerDay > 0
                        ? formatBtc(row.economics.btcPerDay * 30.4375, 3)
                        : '—'}
                    </td>
                    <td className="num">
                      {row.economics.estimatedRevenuePerMonthUsd > 0
                        ? formatUsdCompact(
                            row.economics.estimatedRevenuePerMonthUsd,
                          )
                        : '—'}
                    </td>
                    <td className="num">
                      {formatUsdCompact(
                        row.economics.operatingCostPerMonthUsd,
                      )}
                    </td>
                    <td className="num">
                      {formatUsdCompact(
                        row.economics.netContributionPerMonthUsd,
                      )}
                    </td>
                    <td className="num">
                      {roi == null ? '—' : formatPercent(roi, 0)}
                      {btcRoi != null ? (
                        <span className="cell-sub">
                          BTC {formatPercent(btcRoi, 0)}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge badge--${statusClass}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          disabled={props.demoMode}
                          onClick={() => setEditing(row.asset)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={props.demoMode}
                          onClick={() => void props.onToggleEnabled(row.asset)}
                        >
                          {row.asset.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          disabled={props.demoMode}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${row.asset.model} (${row.asset.serialNumber})?`,
                              )
                            ) {
                              void props.onRemove(row.asset.id);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {props.assets.length === 0 && (
                <tr>
                  <td className="empty-state" colSpan={14}>
                    No miners registered. Add a miner or enable demo mode.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
