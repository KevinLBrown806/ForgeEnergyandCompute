import type { FleetException } from '../domain/types';

export function OperationsExceptions({
  exceptions,
}: {
  exceptions: FleetException[];
}) {
  return (
    <div className="panel">
      <div className="panel__head">
        <h3>Operations exceptions</h3>
        <span className="panel__meta">
          {exceptions.length ? `${exceptions.length} active` : 'All clear'}
        </span>
      </div>
      {exceptions.length === 0 ? (
        <p className="empty-state">No fleet exceptions.</p>
      ) : (
        <ul className="alerts">
          {exceptions.map((item) => (
            <li className={`alert alert--${item.severity}`} key={item.id}>
              <div>
                <strong>
                  {item.kind}
                  {item.miner ? ` · ${item.miner}` : ''}
                </strong>
                <p>{item.reason}</p>
                {(item.observedValue || item.expectedValue) && (
                  <p className="alert__meta">
                    {item.observedValue ? `Observed ${item.observedValue}` : ''}
                    {item.observedValue && item.expectedValue ? ' · ' : ''}
                    {item.expectedValue ? `Expected ${item.expectedValue}` : ''}
                  </p>
                )}
              </div>
              <span className={`badge badge--${item.severity}`}>
                {item.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
