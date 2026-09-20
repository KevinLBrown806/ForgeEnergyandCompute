import type { Request, Response, NextFunction } from 'express';
import { getEnv, safeEqualString, signSession } from '../config/env.js';

const COOKIE_NAME = 'forge_session';

interface SessionPayload {
  v: 1;
  exp: number;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function encodeSession(exp: number, secret: string): string {
  const body = Buffer.from(JSON.stringify({ v: 1, exp } satisfies SessionPayload)).toString(
    'base64url',
  );
  const sig = signSession(body, secret);
  return `${body}.${sig}`;
}

function decodeSession(token: string, secret: string): SessionPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = signSession(body, secret);
  if (!safeEqualString(sig, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (parsed.v !== 1 || typeof parsed.exp !== 'number') return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readSession(req: Request): SessionPayload | null {
  const env = getEnv();
  if (!env.sessionSecret) return null;
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  return decodeSession(raw, env.sessionSecret);
}

export function isAuthenticated(req: Request): boolean {
  return readSession(req) != null;
}

function cookieFlags(): string {
  const env = getEnv();
  const parts = ['Path=/', 'HttpOnly', `Max-Age=${env.sessionTtlSeconds}`];
  if (env.cookieSecure) parts.push('Secure');
  parts.push(`SameSite=${env.cookieSameSite === 'none' ? 'None' : 'Lax'}`);
  return parts.join('; ');
}

export function setSessionCookie(res: Response): void {
  const env = getEnv();
  if (!env.sessionSecret) {
    throw new Error('Session secret not configured');
  }
  const exp = Date.now() + env.sessionTtlSeconds * 1000;
  const token = encodeSession(exp, env.sessionSecret);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieFlags()}`);
}

export function clearSessionCookie(res: Response): void {
  const env = getEnv();
  const parts = ['Path=/', 'HttpOnly', 'Max-Age=0'];
  if (env.cookieSecure) parts.push('Secure');
  parts.push(`SameSite=${env.cookieSameSite === 'none' ? 'None' : 'Lax'}`);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${parts.join('; ')}`);
}

export function verifyOperatorPassword(password: string): boolean {
  const env = getEnv();
  if (!env.operatorPassword) return false;
  return safeEqualString(password, env.operatorPassword);
}

/**
 * Protect Braiins telemetry routes when a Braiins token is configured.
 * Fail closed if auth is not configured — never serve live pool data anonymously.
 */
export function requireTelemetryAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const env = getEnv();
  if (!env.braiinsConfigured) {
    next();
    return;
  }

  if (!env.authConfigured) {
    res.status(503).json({
      ok: false,
      configured: true,
      authRequired: true,
      authConfigured: false,
      error:
        'Braiins telemetry is locked until Forge operator authentication is configured (FORGE_OPERATOR_PASSWORD + FORGE_SESSION_SECRET).',
      code: 'auth_not_configured',
      account: null,
      workers: [],
      rewards: [],
      payouts: [],
      sources: null,
      fetchedAt: null,
      stale: false,
    });
    return;
  }

  if (!isAuthenticated(req)) {
    res.status(401).json({
      ok: false,
      configured: true,
      authRequired: true,
      authConfigured: true,
      error: 'Authentication required to access Braiins telemetry.',
      code: 'auth_required',
      account: null,
      workers: [],
      rewards: [],
      payouts: [],
      sources: null,
      fetchedAt: null,
      stale: false,
    });
    return;
  }

  next();
}

/**
 * Protect owner ledger routes.
 * When operator auth is configured, require a valid session.
 * When auth is not configured (local/dev without secrets), allow access so
 * durable ops remain testable — production with secrets always gates.
 * Never expose these routes anonymously when FORGE_OPERATOR_PASSWORD is set.
 */
export function requireOwnerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const env = getEnv();
  if (!env.authConfigured) {
    if (env.isProduction) {
      res.status(503).json({
        ok: false,
        error:
          'Owner ledger requires FORGE_OPERATOR_PASSWORD and FORGE_SESSION_SECRET in production.',
        code: 'auth_not_configured',
      });
      return;
    }
    (req as Request & { forgeAuthenticated?: boolean }).forgeAuthenticated =
      false;
    next();
    return;
  }

  if (!isAuthenticated(req)) {
    res.status(401).json({
      ok: false,
      error: 'Authentication required to access owner ledger.',
      code: 'auth_required',
      authRequired: true,
      authConfigured: true,
    });
    return;
  }

  (req as Request & { forgeAuthenticated?: boolean }).forgeAuthenticated = true;
  next();
}
