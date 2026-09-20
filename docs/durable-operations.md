# Forge OS v1.3 — Durable Operations

## Persistence architecture

Authoritative owner data lives in a **SQLite** database on the Forge API
(`better-sqlite3`), not in the browser.

| Concern | Location |
| --- | --- |
| Schema + migrations | `server/src/db/migrations/` |
| Typed repositories | `server/src/db/repositories/` |
| Domain models | `server/src/domain/owner.ts` |
| Frontend adapters | `src/adapters/forgeApiRepos.ts` |
| Legacy browser migration | `src/adapters/legacyMigration.ts` |

Environment:

- `FORGE_DATABASE_PATH` — SQLite file path (default `./data/forge.db`)
- Use `:memory:` or `FORGE_DB_MEMORY=1` in tests
- On Render: attach a persistent disk and set `FORGE_DATABASE_PATH=/var/data/forge.db`
  (free web services do not support disks — upgrade or accept ephemeral loss)

Repository interfaces on the frontend (`src/services/repositories.ts`) are
unchanged. Swap implementations without rewriting UI.

## Tables (summary)

- `miner_assets` — full MinerAsset model; unique serial among non-sold units
- `facilities` — sites / MW / rates / terms
- `treasury_positions` — singleton manual overlay
- `treasury_transactions` — **append-only** ledger
- `liabilities` — principals, rates, maturity, secured asset
- `owner_assumptions` / `allocation_targets`
- `market_snapshots` / `network_snapshots` — historical provider captures
- `production_daily` — operating history (LIVE / MANUAL / MODELED / IMPORTED)
- `fleet_snapshots` / `exception_history`
- `audit_events` — mutation trail
- `migration_status` — localStorage import fingerprint
- `accounting_imports` — Found/manual CSV (never LIVE)
- `braiins_sync_state` — connection metrics (token never stored here)

## Migrations

SQL files in `server/src/db/migrations/` apply in lexical order at API boot.
Applied ids are recorded in `schema_migrations`.

## Owner API (authenticated)

When `FORGE_OPERATOR_PASSWORD` + `FORGE_SESSION_SECRET` are set, all
`/api/owner/*` routes require the existing HttpOnly session cookie.

Examples:

- `GET/POST /api/owner/miners`, `PUT/DELETE /api/owner/miners/:id`
- `GET/POST /api/owner/facilities`, …
- `GET /api/owner/treasury`, `POST /api/owner/treasury/transactions` (append-only)
- `GET/PUT /api/owner/settings/*`
- `POST /api/owner/import/miners/preview|commit`
- `GET /api/owner/export`, `GET /api/owner/export/miners.csv`
- `POST /api/owner/migration/localStorage`
- `GET /api/owner/reconciliation`
- `GET /api/owner/history/nav?asOf=…`
- `GET /api/owner/connections/braiins` (never returns the token)
- `POST /api/owner/jobs/snapshots?kind=market|network|all`

Public market/network routes remain unchanged.

## Snapshot jobs

Invoke without hard-coding a vendor scheduler into domain logic:

```bash
# Authenticated operator session, or:
curl -X POST -H "Authorization: Bearer $FORGE_JOB_TRIGGER_SECRET" \
  "https://forge-api.example/api/jobs/snapshots?kind=all"

# CLI on the API host
npm run job:snapshots -- --kind=market
```

Recommended cadence: market every 15 minutes; network every 30–60 minutes.

## Braiins security

- Token: server-only `BRAIINS_API_TOKEN`
- Never in Vite env, browser storage, client logs, or owner API responses
- Connection status exposes configured / sync metrics only

## Found / accounting

**Found Accounting — NOT CONNECTED**

Manual CSV import via `/api/owner/import/accounting` with provenance
`MANUAL` / `IMPORTED`. No scrape. No implied API.

## Reconciliation

`runReconciliation` flags INFO / WARNING / CRITICAL issues including:

- treasury BTC vs ledger
- duplicate serials
- missing facility
- multi-mapped / unmatched Braiins workers
- invalid tx quantity
- negative liability principal
- facility MW overcommit

Issues are never auto-repaired.

## Backup / export

- Full JSON: `GET /api/owner/export`
- Miners CSV: `GET /api/owner/export/miners.csv`
- Restore requires explicit `replace=true`

## Provenance

Unchanged taxonomy: LIVE · MANUAL · MODELED · DERIVED.

Freshness for provider data: LIVE · STALE · FALLBACK · UNAVAILABLE
(`server/src/domain/freshness.ts`).

## Owner onboarding — initial real-data sequence

1. Create facilities (manual or CSV)
2. Import real miners (CSV template → preview → confirm)
3. Map miners to facilities
4. Configure operating rates / assumptions
5. Import treasury history (append transactions)
6. Import liabilities
7. Configure owner assumptions / allocation targets
8. Configure Braiins server token (`BRAIINS_API_TOKEN`)
9. Reconcile workers (Connections + Reconciliation)
10. Review reconciliation exceptions
11. Verify owner KPIs on the executive row (Forge-owned only)
12. Export first JSON backup

## Legacy localStorage migration

Data Management → Backup / Export:

1. Detect browser ledger
2. Download backup
3. Explicit import (duplicate fingerprint blocked)
4. Server marks migration status

After migration, localStorage is not authoritative for financial/asset records.
