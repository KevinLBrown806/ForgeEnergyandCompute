import express from 'express';
import { loadEnv } from './config/env.js';
import { getDb } from './db/client.js';
import { applySecurity } from './middleware/security.js';
import { apiRouter } from './routes/api.js';

let env;
try {
  env = loadEnv();
} catch (err) {
  const message = err instanceof Error ? err.message : 'Invalid environment';
  console.error(`Forge API refused to start: ${message}`);
  process.exit(1);
}

// Initialize durable datastore (migrations) at boot.
try {
  getDb(env.databasePath);
} catch (err) {
  const message = err instanceof Error ? err.message : 'Database init failed';
  console.error(`Forge API refused to start: ${message}`);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
// Owner CSV imports / backups need more than the telemetry 32kb limit.
app.use(express.json({ limit: '2mb' }));
applySecurity(app);

app.get('/', (_req, res) => {
  res.json({
    service: 'forge-api',
    version: '1.3',
    docs: 'GET /api/health, /api/market/snapshot, /api/network/snapshot, /api/auth/session, /api/mining/summary, /api/braiins/*, /api/owner/*, POST /api/jobs/snapshots',
  });
});

app.use('/api', apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(env.port, '0.0.0.0', () => {
  console.log(
    `Forge API listening on 0.0.0.0:${env.port} (braiins=${env.braiinsConfigured}, auth=${env.authConfigured}, db=${env.databasePath})`,
  );
});
