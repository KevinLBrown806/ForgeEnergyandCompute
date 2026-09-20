import { Router } from 'express';
import {
  BraiinsApiError,
  fetchAccountStats,
  fetchMiningSummary,
  fetchPayouts,
  fetchRewards,
  fetchWorkers,
  getBraiinsToken,
} from '../braiins/client.js';
import { getEnv } from '../config/env.js';
import { getDb } from '../db/client.js';
import { runSnapshotJob } from '../jobs/snapshots.js';
import {
  clearSessionCookie,
  isAuthenticated,
  requireTelemetryAuth,
  setSessionCookie,
  verifyOperatorPassword,
} from '../middleware/auth.js';
import { safeErrorMessage } from '../middleware/security.js';
import {
  fetchLiveMarketQuote,
  fetchLiveNetworkSnapshot,
} from '../services/market.js';
import { ownerRouter } from './owner.js';

export const apiRouter = Router();

apiRouter.use('/owner', ownerRouter);

/**
 * Cron / platform scheduler entrypoint.
 * Prefer authenticated owner job route; this path accepts either a valid
 * operator session or `Authorization: Bearer $FORGE_JOB_TRIGGER_SECRET`.
 */
apiRouter.post('/jobs/snapshots', async (req, res) => {
  const env = getEnv();
  const authHeader = req.headers.authorization ?? '';
  const bearer = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const secretOk =
    Boolean(env.jobTriggerSecret) && bearer === env.jobTriggerSecret;
  const sessionOk = env.authConfigured ? isAuthenticated(req) : !env.isProduction;
  if (!secretOk && !sessionOk) {
    res.status(401).json({
      ok: false,
      error: 'Authentication required for snapshot jobs',
      code: 'auth_required',
    });
    return;
  }
  const kind =
    (typeof req.query.kind === 'string' ? req.query.kind : req.body?.kind) ??
    'all';
  if (kind !== 'market' && kind !== 'network' && kind !== 'all') {
    res.status(400).json({ ok: false, error: 'kind must be market|network|all' });
    return;
  }
  try {
    const result = await runSnapshotJob(getDb(), kind);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(502).json({ ok: false, error: safeErrorMessage(err) });
  }
});

apiRouter.get('/health', (_req, res) => {
  const env = getEnv();
  res.json({
    ok: true,
    service: 'forge-api',
    version: '1.3',
    configured: env.braiinsConfigured,
    authConfigured: env.authConfigured,
    durableStore: true,
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/market/snapshot', async (_req, res) => {
  try {
    const quote = await fetchLiveMarketQuote();
    res.json({ ok: true, ...quote, error: null });
  } catch (err) {
    res.status(502).json({
      ok: false,
      btcPriceUsd: null,
      change24hPct: null,
      timestamp: null,
      provider: 'coingecko',
      source: 'MODELED',
      fetchedAt: null,
      stale: false,
      error: safeErrorMessage(err),
    });
  }
});

apiRouter.get('/network/snapshot', async (_req, res) => {
  try {
    const network = await fetchLiveNetworkSnapshot();
    res.json({ ok: true, ...network, error: null });
  } catch (err) {
    res.status(502).json({
      ok: false,
      networkHashrateEhs: null,
      difficulty: null,
      blockHeight: null,
      blockSubsidyBtc: null,
      blocksPerDay: 144,
      nextDifficultyChangePct: null,
      estimatedRetargetDate: null,
      remainingBlocks: null,
      daysUntilAdjustment: null,
      provider: 'mempool.space',
      source: 'MODELED',
      fetchedAt: null,
      stale: false,
      error: safeErrorMessage(err),
    });
  }
});

apiRouter.get('/auth/session', (req, res) => {
  const env = getEnv();
  res.json({
    authenticated: isAuthenticated(req),
    authConfigured: env.authConfigured,
    braiinsConfigured: env.braiinsConfigured,
    // Owner ledger and Braiins telemetry both use the operator session.
    authRequired: env.authConfigured,
  });
});

apiRouter.post('/auth/login', (req, res) => {
  const env = getEnv();
  if (!env.authConfigured) {
    res.status(503).json({
      ok: false,
      error:
        'Operator authentication is not configured. Set FORGE_OPERATOR_PASSWORD and FORGE_SESSION_SECRET on the server.',
      code: 'auth_not_configured',
    });
    return;
  }

  const password =
    typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !verifyOperatorPassword(password)) {
    res.status(401).json({
      ok: false,
      error: 'Invalid credentials',
      code: 'auth_invalid',
    });
    return;
  }

  setSessionCookie(res);
  res.json({ ok: true, authenticated: true });
});

apiRouter.post('/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true, authenticated: false });
});

apiRouter.get('/mining/summary', requireTelemetryAuth, async (_req, res) => {
  const summary = await fetchMiningSummary(getBraiinsToken());
  const status = summary.configured ? (summary.ok ? 200 : 502) : 200;
  res.status(status).json(summary);
});

apiRouter.get('/braiins/stats', requireTelemetryAuth, async (_req, res) => {
  const token = getBraiinsToken();
  if (!token) {
    res.status(200).json({
      configured: false,
      account: null,
      error: 'BRAIINS_API_TOKEN is not configured on the server',
    });
    return;
  }
  try {
    const account = await fetchAccountStats(token);
    res.json({ configured: true, account, error: null });
  } catch (err) {
    const status = err instanceof BraiinsApiError ? err.status : 502;
    res.status(status).json({
      configured: true,
      account: null,
      error: safeErrorMessage(err),
    });
  }
});

apiRouter.get('/braiins/workers', requireTelemetryAuth, async (_req, res) => {
  const token = getBraiinsToken();
  if (!token) {
    res.status(200).json({
      configured: false,
      workers: [],
      error: 'BRAIINS_API_TOKEN is not configured on the server',
    });
    return;
  }
  try {
    const workers = await fetchWorkers(token);
    res.json({ configured: true, workers, error: null });
  } catch (err) {
    const status = err instanceof BraiinsApiError ? err.status : 502;
    res.status(status).json({
      configured: true,
      workers: [],
      error: safeErrorMessage(err),
    });
  }
});

apiRouter.get('/braiins/rewards', requireTelemetryAuth, async (req, res) => {
  const token = getBraiinsToken();
  if (!token) {
    res.status(200).json({
      configured: false,
      rewards: [],
      error: 'BRAIINS_API_TOKEN is not configured on the server',
    });
    return;
  }
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const rewards = await fetchRewards(token, from, to);
    res.json({ configured: true, rewards, error: null });
  } catch (err) {
    const status = err instanceof BraiinsApiError ? err.status : 502;
    res.status(status).json({
      configured: true,
      rewards: [],
      error: safeErrorMessage(err),
    });
  }
});

apiRouter.get('/braiins/payouts', requireTelemetryAuth, async (req, res) => {
  const token = getBraiinsToken();
  if (!token) {
    res.status(200).json({
      configured: false,
      payouts: [],
      error: 'BRAIINS_API_TOKEN is not configured on the server',
    });
    return;
  }
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const payouts = await fetchPayouts(token, from, to);
    res.json({ configured: true, payouts, error: null });
  } catch (err) {
    const status = err instanceof BraiinsApiError ? err.status : 502;
    res.status(status).json({
      configured: true,
      payouts: [],
      error: safeErrorMessage(err),
    });
  }
});
