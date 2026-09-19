import type { PoolWorker } from '../domain/types';
import { formatHashrate, formatNumber } from '../lib/format';

export function WorkersPanel({
  workers,
  configured,
  fetchedAt,
  onRefresh,
}: {
  workers: PoolWorker[];
  configured: boolean;
  fetchedAt: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="panel panel--table">
      <div className="panel__head panel__head--padded">
        <div>
          <h3>Braiins workers · actual</h3>
          <span className="panel__meta">
            {!configured
              ? 'Server token not configured'
              : fetchedAt
                ? `Fetched ${new Date(fetchedAt).toLocaleString()}`
                : 'Waiting for telemetry'}
          </span>
        </div>
        <button className="button" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      <div className="table-wrap">
        <table className="fleet-table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>State</th>
              <th className="num">5m</th>
              <th className="num">60m</th>
              <th className="num">24h</th>
              <th className="num">Shares · 24h</th>
              <th>Last share</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.name}>
                <td>{worker.name}</td>
                <td>
                  <span className={`badge badge--${worker.state}`}>
                    {worker.state}
                  </span>
                </td>
                <td className="num">{formatHashrate(worker.hashRate5mTh)}</td>
                <td className="num">{formatHashrate(worker.hashRate60mTh)}</td>
                <td className="num">{formatHashrate(worker.hashRate24hTh)}</td>
                <td className="num">{formatNumber(worker.shares24h)}</td>
                <td>
                  {worker.lastShareAt
                    ? new Date(worker.lastShareAt).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr>
                <td className="empty-state" colSpan={7}>
                  No worker telemetry available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
