import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ForgeDb = Database.Database;

let singleton: ForgeDb | null = null;
let singletonPath: string | null = null;

export function resolveDatabasePath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.FORGE_DATABASE_PATH?.trim();
  if (explicit) return explicit;
  if (env.NODE_ENV === 'test' || env.FORGE_DB_MEMORY === '1') {
    return ':memory:';
  }
  return join(process.cwd(), 'data', 'forge.db');
}

export function openDatabase(path = resolveDatabasePath()): ForgeDb {
  if (path !== ':memory:') {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function getDb(path?: string): ForgeDb {
  const resolved = path ?? resolveDatabasePath();
  if (singleton && singletonPath === resolved) return singleton;
  if (singleton) {
    singleton.close();
    singleton = null;
  }
  singleton = openDatabase(resolved);
  singletonPath = resolved;
  migrate(singleton);
  return singleton;
}

/** Test helper — always fresh in-memory DB. */
export function openTestDatabase(): ForgeDb {
  const db = openDatabase(':memory:');
  migrate(db);
  return db;
}

export function resetDbSingleton(): void {
  if (singleton) {
    try {
      singleton.close();
    } catch {
      /* ignore */
    }
  }
  singleton = null;
  singletonPath = null;
}

function resolveMigrationsDir(): string {
  const beside = join(__dirname, 'migrations');
  if (existsSync(beside)) return beside;
  const fromCwd = join(process.cwd(), 'src', 'db', 'migrations');
  if (existsSync(fromCwd)) return fromCwd;
  return beside;
}

export function migrate(db: ForgeDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = resolveMigrationsDir();
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => (row as { id: string }).id),
  );

  const insert = db.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
  );

  for (const file of files) {
    const id = file.replace(/\.sql$/, '');
    if (applied.has(id)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const run = db.transaction(() => {
      db.exec(sql);
      insert.run(id, new Date().toISOString());
    });
    run();
  }
}

export function fingerprintPayload(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 32);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
