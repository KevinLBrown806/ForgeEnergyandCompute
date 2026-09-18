import express from 'express';
import { applySecurity } from './middleware/security.js';
import { apiRouter } from './routes/api.js';

const port = Number(process.env.PORT) || 8787;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
applySecurity(app);

app.get('/', (_req, res) => {
  res.json({
    service: 'forge-api',
    docs: 'GET /api/health, /api/mining/summary, /api/braiins/*',
  });
});

app.use('/api', apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(port, '0.0.0.0', () => {
  // Do not log token presence details beyond configured boolean.
  const configured = Boolean(process.env.BRAIINS_API_TOKEN?.trim());
  console.log(`Forge API listening on 0.0.0.0:${port} (braiins configured=${configured})`);
});
