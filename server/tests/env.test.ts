import { afterEach, describe, expect, it } from 'vitest';
import { loadEnv, resetEnvCache } from '../src/config/env.js';

describe('env validation', () => {
  afterEach(() => {
    resetEnvCache();
    delete process.env.BRAIINS_API_TOKEN;
    delete process.env.FORGE_OPERATOR_PASSWORD;
    delete process.env.FORGE_SESSION_SECRET;
    delete process.env.CORS_ORIGINS;
    delete process.env.RATE_LIMIT_PER_MINUTE;
    delete process.env.BRAIINS_TIMEOUT_MS;
    delete process.env.BRAIINS_REQUEST_INTERVAL_MS;
    delete process.env.NODE_ENV;
  });

  it('loads safe defaults without Braiins token', () => {
    const env = loadEnv({});
    expect(env.braiinsConfigured).toBe(false);
    expect(env.authConfigured).toBe(false);
    expect(env.rateLimitPerMinute).toBe(60);
    expect(env.braiinsTimeoutMs).toBe(12_000);
    expect(env.corsOrigins.length).toBeGreaterThan(0);
  });

  it('rejects CORS_ORIGINS=* when Braiins is configured', () => {
    expect(() =>
      loadEnv({
        BRAIINS_API_TOKEN: 'secret-token',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/CORS_ORIGINS=\*/);
  });

  it('rejects CORS_ORIGINS=* in production', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/CORS_ORIGINS=\*/);
  });

  it('fails closed in production when Braiins is set without operator auth', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        BRAIINS_API_TOKEN: 'secret-token',
        CORS_ORIGINS: 'https://app.example.com',
      }),
    ).toThrow(/FORGE_OPERATOR_PASSWORD/);
  });

  it('accepts production Braiins when operator auth is configured', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      BRAIINS_API_TOKEN: 'secret-token',
      FORGE_OPERATOR_PASSWORD: 'op-password',
      FORGE_SESSION_SECRET: 'a'.repeat(32),
      CORS_ORIGINS: 'https://app.example.com',
    });
    expect(env.braiinsConfigured).toBe(true);
    expect(env.authConfigured).toBe(true);
    expect(env.cookieSameSite).toBe('none');
    expect(env.cookieSecure).toBe(true);
  });

  it('rejects non-integer RATE_LIMIT_PER_MINUTE', () => {
    expect(() =>
      loadEnv({
        RATE_LIMIT_PER_MINUTE: 'fast',
      }),
    ).toThrow(/RATE_LIMIT_PER_MINUTE/);
  });

  it('rejects out-of-range BRAIINS_TIMEOUT_MS', () => {
    expect(() =>
      loadEnv({
        BRAIINS_TIMEOUT_MS: '50',
      }),
    ).toThrow(/BRAIINS_TIMEOUT_MS/);
  });

  it('parses BRAIINS_REQUEST_INTERVAL_MS', () => {
    const env = loadEnv({
      BRAIINS_REQUEST_INTERVAL_MS: '2500',
    });
    expect(env.braiinsRequestIntervalMs).toBe(2500);
  });
});
