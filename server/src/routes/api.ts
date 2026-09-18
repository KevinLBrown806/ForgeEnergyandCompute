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
import { safeErrorMessage } from '../middleware/security.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  const configured = Boolean(getBraiinsToken());
  res.json({
    ok: true,
    service: 'forge-api',
    configured,
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/mining/summary', async (_req, res) => {
  const summary = await fetchMiningSummary(getBraiinsToken());
  const status = summary.configured ? (summary.ok ? 200 : 502) : 200;
  res.status(status).json(summary);
});

apiRouter.get('/braiins/stats', async (_req, res) => {
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

apiRouter.get('/braiins/workers', async (_req, res) => {
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

apiRouter.get('/braiins/rewards', async (req, res) => {
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

apiRouter.get('/braiins/payouts', async (req, res) => {
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
