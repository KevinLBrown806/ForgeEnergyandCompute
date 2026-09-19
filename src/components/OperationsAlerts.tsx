import type { OperationsAlert } from '../domain/types';

export function OperationsAlerts({
  alerts,
}: {
  alerts: OperationsAlert[];
}) {
  return (
    <div className="panel">
      <div className="panel__head">
        <h3>Operations alerts</h3>
        <span className="panel__meta">
          {alerts.length ? `${alerts.length} active` : 'All clear'}
        </span>
      </div>
      {alerts.length === 0 ? (
        <p className="empty-state">No active fleet alerts.</p>
      ) : (
        <ul className="alerts">
          {alerts.map((alert) => (
            <li
              className={`alert alert--${alert.severity}`}
              key={alert.id}
            >
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.detail}</p>
              </div>
              <span className={`badge badge--${alert.severity}`}>
                {alert.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
