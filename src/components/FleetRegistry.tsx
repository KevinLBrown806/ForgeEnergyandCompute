import { useState } from 'react';
import type {
  FleetRow,
  MinerAsset,
  MinerAssetInput,
  PoolWorker,
} from '../domain/types';
import { formatHashrate, formatNumber, formatUsdCompact } from '../lib/format';
import { MinerForm } from './MinerForm';

interface FleetRegistryProps {
  assets: MinerAsset[];
  rows: FleetRow[];
  workers: PoolWorker[];
  demoMode: boolean;
  onDemoModeChange: (enabled: boolean) => Promise<void>;
  onCreate: (input: MinerAssetInput) => Promise<void>;
  onUpdate: (id: string, input: MinerAssetInput) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onToggleEnabled: (asset: MinerAsset) => Promise<void>;
}

export function FleetRegistry(props: FleetRegistryProps) {
  const [editing, setEditing] = useState<MinerAsset | 'new' | null>(null);

  const save = async (input: MinerAssetInput) => {
    if (editing === 'new') await props.onCreate(input);
    else if (editing) await props.onUpdate(editing.id, input);
    setEditing(null);
  };

  return (
    <>
      <div className="panel registry-toolbar">
        <div>
          <h3>Fleet registry</h3>
          <p className="panel__meta">
            Inventory is stored in this browser. Pool telemetry is read-only.
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
          operating registry.
        </p>
      )}

      {editing && !props.demoMode && (
        <div className="panel">
          <div className="panel__head">
            <h3>{editing === 'new' ? 'Add miner' : 'Edit miner'}</h3>
            <span className="panel__meta">Inventory record</span>
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

      <div className="panel panel--table">
        <div className="table-wrap">
          <table className="fleet-table">
            <thead>
              <tr className="table-groups">
                <th colSpan={5}>Inventory</th>
                <th colSpan={4}>Live · actual</th>
                <th colSpan={2}>Calculated</th>
                <th aria-label="Actions" />
              </tr>
              <tr>
                <th>Model / serial</th>
                <th className="num">Qty</th>
                <th className="num">Nominal</th>
                <th>Worker</th>
                <th>Status</th>
                <th>Health</th>
                <th className="num">5m</th>
                <th className="num">24h</th>
                <th>Last share</th>
                <th className="num">Net / mo</th>
                <th className="num">Cost / BTC</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr
                  key={row.asset.id}
                  className={row.asset.enabled ? '' : 'row--muted'}
                >
                  <td>
                    {row.asset.model}
                    <span className="cell-sub">{row.asset.serialNumber}</span>
                  </td>
                  <td className="num">{formatNumber(row.asset.quantity)}</td>
                  <td className="num">
                    {formatHashrate(
                      row.asset.quantity * row.asset.nominalHashrateTh,
                    )}
                  </td>
                  <td>{row.asset.braiinsWorkerName ?? 'Unmapped'}</td>
                  <td>
                    <span className={`badge badge--${row.asset.status}`}>
                      {row.asset.status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge--${row.health.toLowerCase()}`}>
                      {row.health}
                    </span>
                  </td>
                  <td className="num">
                    {row.live5mTh == null ? '—' : formatHashrate(row.live5mTh)}
                  </td>
                  <td className="num">
                    {row.live24hTh == null ? '—' : formatHashrate(row.live24hTh)}
                  </td>
                  <td>
                    {row.lastShareAt
                      ? new Date(row.lastShareAt).toLocaleString()
                      : '—'}
                  </td>
                  <td className="num">
                    {formatUsdCompact(
                      row.economics.netContributionPerMonthUsd,
                    )}
                  </td>
                  <td className="num">
                    {row.economics.costPerBtcUsd == null
                      ? '—'
                      : formatUsdCompact(row.economics.costPerBtcUsd)}
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
              ))}
              {props.assets.length === 0 && (
                <tr>
                  <td className="empty-state" colSpan={12}>
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
