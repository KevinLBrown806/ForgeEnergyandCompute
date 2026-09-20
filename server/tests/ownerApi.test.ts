import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { resetBraiinsClientState } from '../src/braiins/client.js';
import { loadEnv, resetEnvCache } from '../src/config/env.js';
import { resetDbSingleton, getDb } from '../src/db/client.js';
import { applySecurity } from '../src/middleware/security.js';
import { apiRouter } from '../src/routes/api.js';

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  applySecurity(app);
  app.use('/api', apiRouter);
  return app;
}

describe('owner route security', () => {
  beforeEach(() => {
    resetEnvCache();
    resetDbSingleton();
    resetBraiinsClientState();
    process.env.FORGE_DB_MEMORY = '1';
    process.env.BRAIINS_REQUEST_INTERVAL_MS = '0';
  });

  afterEach(() => {
    resetEnvCache();
    resetDbSingleton();
    resetBraiinsClientState();
    delete process.env.BRAIINS_API_TOKEN;
    delete process.env.FORGE_OPERATOR_PASSWORD;
    delete process.env.FORGE_SESSION_SECRET;
    delete process.env.FORGE_COOKIE_SAMESITE;
    delete process.env.CORS_ORIGINS;
    delete process.env.BRAIINS_REQUEST_INTERVAL_MS;
    delete process.env.FORGE_DB_MEMORY;
    delete process.env.FORGE_DATABASE_PATH;
    delete process.env.NODE_ENV;
    delete process.env.FORGE_JOB_TRIGGER_SECRET;
  });

  it('rejects unauthenticated owner routes when auth is configured', async () => {
    loadEnv({
      NODE_ENV: 'test',
      FORGE_OPERATOR_PASSWORD: 'correct-horse',
      FORGE_SESSION_SECRET: 'c'.repeat(32),
      CORS_ORIGINS: 'http://localhost:5173',
      FORGE_DB_MEMORY: '1',
    });
    getDb(':memory:');
    const app = buildApp();
    const denied = await request(app).get('/api/owner/miners');
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('auth_required');
  });

  it('serves owner miners after login and never returns Braiins token', async () => {
    loadEnv({
      NODE_ENV: 'test',
      BRAIINS_API_TOKEN: 'super-secret-pool-token',
      FORGE_OPERATOR_PASSWORD: 'correct-horse',
      FORGE_SESSION_SECRET: 'd'.repeat(32),
      CORS_ORIGINS: 'http://localhost:5173',
      FORGE_DB_MEMORY: '1',
    });
    getDb(':memory:');
    const app = buildApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ password: 'correct-horse' });
    expect(login.status).toBe(200);
    const cookie = String(login.headers['set-cookie'][0]).split(';')[0];

    const miners = await request(app)
      .get('/api/owner/miners')
      .set('Cookie', cookie);
    expect(miners.status).toBe(200);
    expect(miners.body.ok).toBe(true);

    const connections = await request(app)
      .get('/api/owner/connections/braiins')
      .set('Cookie', cookie);
    expect(connections.status).toBe(200);
    expect(JSON.stringify(connections.body)).not.toContain('super-secret-pool-token');
    expect(connections.body.braiins.configured).toBe(true);
    expect(connections.body.accounting.status).toBe('NOT CONNECTED');
  });

  it('refuses destructive treasury deletes', async () => {
    loadEnv({
      NODE_ENV: 'test',
      FORGE_OPERATOR_PASSWORD: 'correct-horse',
      FORGE_SESSION_SECRET: 'e'.repeat(32),
      CORS_ORIGINS: 'http://localhost:5173',
      FORGE_DB_MEMORY: '1',
    });
    getDb(':memory:');
    const app = buildApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ password: 'correct-horse' });
    const cookie = String(login.headers['set-cookie'][0]).split(';')[0];

    const del = await request(app)
      .delete('/api/owner/treasury/transactions/tx-x')
      .set('Cookie', cookie);
    expect(del.status).toBe(405);
    expect(String(del.body.error)).toMatch(/append-only/i);
  });
});
