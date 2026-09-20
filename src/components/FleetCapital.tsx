import type { CapitalRecoveryRow } from '../domain/capitalRecovery';
import { minerTotalCostBasisUsd } from '../domain/ledger';
import type { FleetCapitalTotals } from '../domain/ledger';
import type { MinerAsset } from '../domain/types';
import {
  formatHashrate,
  formatMw,
  formatNumber,
  formatPercent,
  formatUsdCompact,
} from '../lib/format';

export function FleetCapital({
  totals,
  assets,
  recovery,
  demoMode,
}: {
  totals: FleetCapitalTotals;
  assets: MinerAsset[];
  recovery: CapitalRecoveryRow[];
  demoMode: boolean;
}) {
  const recoveryById = new Map(recovery.map((row) => [row.minerId, row]));

  return (
    <div className="panel panel--table">
      <div className="panel__head panel__head--padded">
        <div>
          <h3>Fleet capital</h3>
          <span className="panel__meta">
            {demoMode
              ? 'DEMO inventory · not Forge-owned'
              : 'Owned inventory · MANUAL cost basis'}
          </span>
        </div>
      </div>
      <div className="grid grid--cards grid--compact fleet-totals">
        <div className="stat-card">
          <p className="stat-card__label">Miners owned</p>
          <p className="stat-card__value">{formatNumber(totals.minersOwned)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Machines online</p>
          <p className="stat-card__value">{formatNumber(totals.machinesOnline)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Total TH/s</p>
          <p className="stat-card__value">{formatHashrate(totals.totalTh)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Total MW</p>
          <p className="stat-card__value">{formatMw(totals.totalMw)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Original hardware cost</p>
          <p className="stat-card__value">
            {totals.originalHardwareCostUsd == null
              ? '—'
              : formatUsdCompact(totals.originalHardwareCostUsd)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Deployment cost</p>
          <p className="stat-card__value">
            {totals.deploymentCostUsd == null
              ? '—'
              : formatUsdCompact(totals.deploymentCostUsd)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Deployed capital</p>
          <p className="stat-card__value">
            {totals.totalDeployedCapitalUsd == null
              ? '—'
              : formatUsdCompact(totals.totalDeployedCapitalUsd)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Hardware book value</p>
          <p className="stat-card__value">
            {totals.estimatedHardwareBookValueUsd == null
              ? '—'
              : formatUsdCompact(totals.estimatedHardwareBookValueUsd)}
          </p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="fleet-table">
          <thead>
            <tr>
              <th>Miner</th>
              <th className="num">Acquisition</th>
              <th>Deployed</th>
              <th className="num">BTC produced</th>
              <th className="num">Revenue</th>
              <th className="num">Op. cost</th>
              <th className="num">Contribution</th>
              <th className="num">Recovered</th>
              <th className="num">Unrecovered</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const row = recoveryById.get(asset.id);
              const cost = minerTotalCostBasisUsd(asset);
              return (
                <tr key={asset.id}>
                  <td>
                    {asset.manufacturer ? `${asset.manufacturer} ` : ''}
                    {asset.model}
                    <span className="cell-sub">{asset.serialNumber}</span>
                  </td>
                  <td className="num">
                    {cost == null ? '—' : formatUsdCompact(cost)}
                  </td>
                  <td>{asset.deploymentDate ?? asset.acquisitionDate ?? '—'}</td>
                  {row?.sufficientHistory ? (
                    <>
                      <td className="num">
                        {row.cumulativeBtcProduced?.toFixed(4) ?? '—'}
                      </td>
                      <td className="num">
                        {row.cumulativeMiningRevenueUsd == null
                          ? '—'
                          : formatUsdCompact(row.cumulativeMiningRevenueUsd)}
                      </td>
                      <td className="num">
                        {row.cumulativeOperatingCostUsd == null
                          ? '—'
                          : formatUsdCompact(row.cumulativeOperatingCostUsd)}
                      </td>
                      <td className="num">
                        {row.cumulativeContributionUsd == null
                          ? '—'
                          : formatUsdCompact(row.cumulativeContributionUsd)}
                      </td>
                      <td className="num">
                        {row.capitalRecoveredPct == null
                          ? '—'
                          : formatPercent(row.capitalRecoveredPct, 0)}
                      </td>
                      <td className="num">
                        {row.remainingUnrecoveredUsd == null
                          ? '—'
                          : formatUsdCompact(row.remainingUnrecoveredUsd)}
                      </td>
                    </>
                  ) : (
                    <td className="empty-state" colSpan={6}>
                      Insufficient history
                    </td>
                  )}
                </tr>
              );
            })}
            {assets.length === 0 && (
              <tr>
                <td className="empty-state" colSpan={9}>
                  No owned miners in the ledger.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
