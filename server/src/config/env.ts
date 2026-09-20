import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface ForgeEnv {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  braiinsToken: string | undefined;
  braiinsConfigured: boolean;
  corsOrigins: string[];
  corsAllowCredentials: boolean;
  rateLimitPerMinute: number;
  braiinsTimeoutMs: number;
  braiinsRequestIntervalMs: number;
  operatorPassword: string | undefined;
  sessionSecret: string | undefined;
  /** True when operator password + session secret are both set. */
  authConfigured: boolean;
  sessionTtlSeconds: number;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'none';
  /** SQLite path for durable owner ledger (`:memory:` for tests). */
  databasePath: string;
  /** Optional shared secret for cron/job triggers (in addition to owner auth). */
  jobTriggerSecret: string | undefined;
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  name: string,
  opts?: { min?: number; max?: number },
): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${name} must be an integer (got a non-integer value)`);
  }
  if (opts?.min != null && n < opts.min) {
    throw new Error(`${name} must be >= ${opts.min}`);
  }
  if (opts?.max != null && n > opts.max) {
    throw new Error(`${name} must be <= ${opts.max}`);
  }
  return n;
}

function parseCorsOrigins(
  raw: string | undefined,
  braiinsConfigured: boolean,
  isProduction: boolean,
): string[] {
  const fallback = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
  if (raw == null || raw.trim() === '') return fallback;
  const trimmed = raw.trim();
  if (trimmed === '*') {
    if (braiinsConfigured || isProduction) {
      throw new Error(
        'CORS_ORIGINS=* is not allowed when BRAIINS_API_TOKEN is set or NODE_ENV=production. Use an explicit allowlist.',
      );
    }
    return fallback;
  }
  const origins = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.length === 0) return fallback;
  if (origins.includes('*')) {
    throw new Error(
      'CORS_ORIGINS must not include * in an allowlist. Provide exact origins.',
    );
  }
  return origins;
}

let cached: ForgeEnv | null = null;

/** Parse and validate process env. Throws on unsafe production configuration. */
export function loadEnv(env: NodeJS.ProcessEnv = process.env): ForgeEnv {
  const nodeEnv = env.NODE_ENV?.trim() || 'development';
  const isProduction = nodeEnv === 'production';
  const braiinsToken = env.BRAIINS_API_TOKEN?.trim() || undefined;
  const braiinsConfigured = Boolean(braiinsToken);

  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS, braiinsConfigured, isProduction);
  const rateLimitPerMinute = parsePositiveInt(
    env.RATE_LIMIT_PER_MINUTE,
    60,
    'RATE_LIMIT_PER_MINUTE',
    { min: 1, max: 10_000 },
  );
  const braiinsTimeoutMs = parsePositiveInt(
    env.BRAIINS_TIMEOUT_MS,
    12_000,
    'BRAIINS_TIMEOUT_MS',
    { min: 1_000, max: 120_000 },
  );
  const braiinsRequestIntervalMs = parsePositiveInt(
    env.BRAIINS_REQUEST_INTERVAL_MS,
    5_000,
    'BRAIINS_REQUEST_INTERVAL_MS',
    { min: 0, max: 60_000 },
  );
  const port = parsePositiveInt(env.PORT, 8787, 'PORT', { min: 1, max: 65_535 });
  const sessionTtlSeconds = parsePositiveInt(
    env.FORGE_SESSION_TTL_SECONDS,
    60 * 60 * 12,
    'FORGE_SESSION_TTL_SECONDS',
    { min: 300, max: 60 * 60 * 24 * 7 },
  );

  const operatorPassword = env.FORGE_OPERATOR_PASSWORD?.trim() || undefined;
  const sessionSecret = env.FORGE_SESSION_SECRET?.trim() || undefined;
  const authConfigured = Boolean(operatorPassword && sessionSecret);

  if (braiinsConfigured && isProduction && !authConfigured) {
    throw new Error(
      'BRAIINS_API_TOKEN is set in production but Forge operator auth is not configured. Set FORGE_OPERATOR_PASSWORD and FORGE_SESSION_SECRET (or unset BRAIINS_API_TOKEN).',
    );
  }

  // Primary production path: Netlify same-origin /api proxy → SameSite=Lax + Secure.
  // Opt into SameSite=None only for direct cross-origin browser→Render testing.
  const sameSiteRaw = env.FORGE_COOKIE_SAMESITE?.trim().toLowerCase();
  let cookieSameSite: 'lax' | 'none' = 'lax';
  if (sameSiteRaw === 'none') {
    cookieSameSite = 'none';
  } else if (sameSiteRaw === 'lax' || sameSiteRaw == null || sameSiteRaw === '') {
    cookieSameSite = 'lax';
  } else {
    throw new Error('FORGE_COOKIE_SAMESITE must be "lax" or "none"');
  }
  // SameSite=None requires Secure; production always uses Secure.
  const cookieSecure = isProduction || cookieSameSite === 'none';

  const databasePath =
    env.FORGE_DATABASE_PATH?.trim() ||
    (nodeEnv === 'test' || env.FORGE_DB_MEMORY === '1'
      ? ':memory:'
      : `${process.cwd()}/data/forge.db`);
  const jobTriggerSecret = env.FORGE_JOB_TRIGGER_SECRET?.trim() || undefined;

  const result: ForgeEnv = {
    port,
    nodeEnv,
    isProduction,
    braiinsToken,
    braiinsConfigured,
    corsOrigins,
    corsAllowCredentials: true,
    rateLimitPerMinute,
    braiinsTimeoutMs,
    braiinsRequestIntervalMs,
    operatorPassword,
    sessionSecret,
    authConfigured,
    sessionTtlSeconds,
    cookieSecure,
    cookieSameSite,
    databasePath,
    jobTriggerSecret,
  };
  cached = result;
  return result;
}

export function getEnv(): ForgeEnv {
  if (!cached) return loadEnv();
  return cached;
}

/** Test helper. */
export function resetEnvCache(): void {
  cached = null;
}

export function generateSessionSecret(): string {
  return randomBytes(32).toString('hex');
}

export function signSession(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}
