/**
 * CLI entry for snapshot jobs (cron / manual).
 * Usage: npm run job:snapshots -- --kind=all|market|network
 */
import { loadEnv } from '../config/env.js';
import { getDb } from '../db/client.js';
import { runSnapshotJob } from './snapshots.js';

const env = loadEnv();
const kindArg = process.argv.find((a) => a.startsWith('--kind='));
const kind = (kindArg?.split('=')[1] ?? 'all') as 'market' | 'network' | 'all';

const db = getDb(env.databasePath);
const result = await runSnapshotJob(db, kind);
console.log(JSON.stringify({ ok: true, result }, null, 2));
