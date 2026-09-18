import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { resetBraiinsClientState } from '../src/braiins/client.js';
import { loadEnv, resetEnvCache } from '../src/config/env.js';
import { applySecurity } from '../src/middleware/security.js';
import { apiRouter } from '../src/routes/api.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  applySecurity(app);
  app.use('/api', apiRouter);
  return app;
}

describe('telemetry authentication', () => {
  beforeEach(() => {
    resetEnvCache();
    resetBraiinsClientState();
    process.env.BRAIINS_REQUEST_INTERVAL_MS = '0';
  });

  afterEach(() => {
    resetEnvCache();
    resetBraiinsClientState();
    delete process.env.BRAIINS_API_TOKEN;
    delete process.env.FORGE_OPERATOR_PASSWORD;
    delete process.env.FORGE_SESSION_SECRET;
    delete process.env.FORGE_COOKIE_SAMESITE;
    delete process.env.CORS_ORIGINS;
    delete process.env.BRAIINS_REQUEST_INTERVAL_MS;
    delete process.env.NODE_ENV;
  });

  it('allows anonymous mining summary when Braiins is not configured', async () => {
    loadEnv({ NODE_ENV: 'test' });
    const res = await request(buildApp()).get('/api/mining/summary');
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });

  it('fails closed with 503 when Braiins is configured without operator auth', async () => {
    loadEnv({
      NODE_ENV: 'test',
      BRAIINS_API_TOKEN: 'pool-token',
      CORS_ORIGINS: 'http://localhost:5173',
    });
    const res = await request(buildApp()).get('/api/mining/summary');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('auth_not_configured');
    expect(res.body.authRequired).toBe(true);
  });

  it('requires login before serving Braiins telemetry when auth is configured', async () => {
    loadEnv({
      NODE_ENV: 'test',
      BRAIINS_API_TOKEN: 'pool-token',
      FORGE_OPERATOR_PASSWORD: 'correct-horse',
      FORGE_SESSION_SECRET: 'b'.repeat(32),
      CORS_ORIGINS: 'http://localhost:5173',
    });
    const app = buildApp();

    const denied = await request(app).get('/api/mining/summary');
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('auth_required');

    const badLogin = await request(app)
      .post('/api/auth/login')
      .send({ password: 'wrong' });
    expect(badLogin.status).toBe(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ password: 'correct-horse' });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeTruthy();

    const cookie = String(login.headers['set-cookie'][0]).split(';')[0];
    const authed = await request(app)
      .get('/api/braiins/workers')
      .set('Cookie', cookie);
    expect(authed.status).not.toBe(401);
    expect(authed.status).not.toBe(503);
  });

  it('sets HttpOnly Secure SameSite=Lax cookies for production same-origin proxy', async () => {
    loadEnv({
      NODE_ENV: 'production',
      BRAIINS_API_TOKEN: 'pool-token',
      FORGE_OPERATOR_PASSWORD: 'correct-horse',
      FORGE_SESSION_SECRET: 'b'.repeat(32),
      CORS_ORIGINS: 'https://forge-energy-and-compute.netlify.app',
    });
    const app = buildApp();

    const denied = await request(app).get('/api/mining/summary');
    expect(denied.status).toBe(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ password: 'correct-horse' });
    expect(login.status).toBe(200);
    const setCookie = String(login.headers['set-cookie']?.[0] ?? '');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toMatch(/SameSite=None/i);

    const cookie = setCookie.split(';')[0];
    const session = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie);
    expect(session.status).toBe(200);
    expect(session.body.authenticated).toBe(true);

    const deniedAgain = await request(app).get('/api/mining/summary');
    expect(deniedAgain.status).toBe(401);
  });
});
