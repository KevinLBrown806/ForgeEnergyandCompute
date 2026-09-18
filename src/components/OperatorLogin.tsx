import { useState, type FormEvent } from 'react';

interface OperatorLoginProps {
  onLogin: (password: string) => Promise<string | null>;
  authConfigured: boolean;
}

/**
 * Operator login for Braiins telemetry.
 * Password is posted to Forge API only — never stored in Vite env, localStorage, or the bundle.
 */
export function OperatorLogin({ onLogin, authConfigured }: OperatorLoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const message = await onLogin(password);
      if (message) setError(message);
      else setPassword('');
    } finally {
      setPending(false);
    }
  };

  if (!authConfigured) {
    return (
      <div className="panel auth-panel">
        <div className="panel__head">
          <h3>Operator authentication required</h3>
        </div>
        <p className="notice notice--warning">
          Braiins telemetry is configured on the server but Forge operator auth
          is not. Set <code>FORGE_OPERATOR_PASSWORD</code> and{' '}
          <code>FORGE_SESSION_SECRET</code> on the API service. Live pool data
          stays locked until then.
        </p>
      </div>
    );
  }

  return (
    <div className="panel auth-panel">
      <div className="panel__head">
        <h3>Operator sign-in</h3>
        <span className="panel__meta">HttpOnly session · no browser secrets</span>
      </div>
      <p className="notice">
        Braiins pool telemetry requires an authenticated Forge operator session.
        CORS remains a browser restriction only — it is not the security boundary.
      </p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Operator password
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button--primary" disabled={pending} type="submit">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
