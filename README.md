# Forge Energy & Compute

Forge OS is a mining operations dashboard for the strategy:

**Energy → Compute → Bitcoin → Treasury → Infrastructure**

The React frontend maintains a local fleet registry, combines registered
inventory with Braiins Pool telemetry from the Forge API, and keeps the mining
calculator explicitly separated as a modeled/scenario tool.

## Data provenance

Every primary KPI is tagged:

| Source | Meaning |
| --- | --- |
| **LIVE** | Automatically sourced from a verified external system (Braiins, CoinGecko, mempool.space) |
| **MANUAL** | Entered from Forge company records (owner ledger / data management) |
| **MODELED** | Calculated using assumptions or scenarios |
| **DERIVED** | Computed from other LIVE / MANUAL / MODELED inputs, with inspectable dependencies |

## Architecture

- `src/config/forge.config.ts` — domain-organized `forgeData` (company, actuals, fleet, treasury, energy, market, assumptions, scenarios, roadmap)
- `src/domain/` — canonical fleet, worker, reward, payout, alert, and treasury DTOs plus pure matching/health/aggregation logic
- `src/domain/dataSource.ts` — `LIVE` / `MANUAL` / `MODELED` / `DERIVED` provenance types
- `src/data/providers/` — swap-ready market, network, mining-pool, and Found accounting adapters
- `src/adapters/localStorage.ts` — owner ledger persistence behind repository interfaces
- `src/services/forgeApi.ts` — the only frontend path to Forge API (Braiins, market, network)
- `src/lib/mining.ts` — pure mining economics engine
- `src/lib/unitEconomics.ts` — per-miner unit economics and breakevens
- `src/lib/treasuryLedger.ts` — append-only treasury transaction aggregation
- `src/lib/nav.ts` — NAV from assets and liabilities
- `src/lib/treasury.ts` — treasury valuation helper (manual position overlay)
- `server/` — Node/TypeScript Forge API (Braiins token stays server-side)

The default fleet and treasury are empty. Demo mode is opt-in and clearly
labeled; demo assets are not written to the operating registry.

## Editing operating data

1. **Fleet** — Dashboard → Fleet operations → + Add Miner (preferred), or Demo mode for placeholders in `src/config/demoFleet.ts`
2. **Treasury** — Manual treasury editor (BTC held, mined, purchased, sold, cash, hardware book value, liabilities)
3. **Market assumptions** — `forgeData.market` in `src/config/forge.config.ts` (MODELED until LIVE feeds connect)

## Local development

Install frontend and API dependencies:

```bash
npm ci
npm --prefix server ci
```

Start the API and frontend in separate terminals:

```bash
export BRAIINS_API_TOKEN="your-read-only-token"
export CORS_ORIGINS="http://localhost:5173"
npm run server:dev
```

```bash
npm run dev
```

Vite listens on `0.0.0.0:$PORT` (default `5173`) and proxies `/api` to
`http://localhost:8787`. Production Netlify does the same via a `/api/*`
rewrite to Render. Leave `VITE_FORGE_API_BASE_URL` unset for same-origin
`/api/...` requests. Set it only when you intentionally call a Forge origin
directly (no trailing slash).

Copy `.env.example` only as a list of supported variable names. The server does
not load committed env files and no real secret belongs in Git, frontend
variables, logs, tests, or screenshots.

## Braiins access profile

In Braiins Pool, create a dedicated access profile/token for monitoring. Grant
only the read permissions needed for profile/statistics, workers, rewards, and
payout history. Do not grant payout-management privileges.

Set the token only as `BRAIINS_API_TOKEN` on the Forge API service. Never create
a `VITE_BRAIINS_*` variable: every browser request must go through Forge API.

The API uses the official `https://pool.braiins.com` endpoints and
`Pool-Auth-Token` header, converts reported hashrates to TH/s, masks payout
destinations, caches normalized responses for 30 seconds, spaces upstream
requests by about five seconds, and applies a 12-second request timeout.

## Forge API

Routes:

- `GET /api/health`
- `GET /api/market/snapshot` — public BTC/USD (CoinGecko proxy, no auth)
- `GET /api/network/snapshot` — public Bitcoin network (mempool.space proxy, no auth)
- `GET /api/mining/summary`
- `GET /api/braiins/stats`
- `GET /api/braiins/workers`
- `GET /api/braiins/rewards?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/braiins/payouts?from=YYYY-MM-DD&to=YYYY-MM-DD`

Runtime variables:

| Variable | Purpose |
| --- | --- |
| `BRAIINS_API_TOKEN` | Server-only Braiins access token |
| `CORS_ORIGINS` | Exact allowlist of frontend origins (defense in depth) |
| `FORGE_OPERATOR_PASSWORD` | Operator login password (server-only) |
| `FORGE_SESSION_SECRET` | HMAC secret for HttpOnly session cookies |
| `FORGE_COOKIE_SAMESITE` | `lax` (default, Netlify same-origin proxy) or `none` (direct cross-origin testing) |
| `PORT` | API listen port (Render supplies this) |
| `RATE_LIMIT_PER_MINUTE` | Forge API per-client request limit |
| `BRAIINS_TIMEOUT_MS` | Optional upstream timeout override |
| `BRAIINS_REQUEST_INTERVAL_MS` | Optional upstream request-spacing override |
| `VITE_FORGE_API_BASE_URL` | Optional absolute Forge origin; unset = same-origin `/api` |


## Authentication & production gate

CORS is **not** authentication. When `BRAIINS_API_TOKEN` is set, Forge requires an
operator session before serving `/api/mining/summary` or `/api/braiins/*`.

Architecture:

1. Operator signs in with `FORGE_OPERATOR_PASSWORD` via `POST /api/auth/login`.
2. Server sets an **HttpOnly** signed session cookie (`FORGE_SESSION_SECRET`).
   Production defaults: `Secure` + `SameSite=Lax` (same-origin Netlify `/api` proxy).
   Set `FORGE_COOKIE_SAMESITE=none` only for direct cross-origin browser→Render tests
   (`Secure` remains required whenever `SameSite=None`).
3. Browser calls use `credentials: "include"` against same-origin `/api/...`.
   No API password/token is placed in Vite env, JS bundles, `localStorage`, or query strings.
4. Do **not** create `VITE_FORGE_SECRET` or any `VITE_BRAIINS_*` variable.

Production fail-closed rules:

- If `BRAIINS_API_TOKEN` is set and `NODE_ENV=production`, startup refuses to boot
  unless both `FORGE_OPERATOR_PASSWORD` and `FORGE_SESSION_SECRET` are set.
- `CORS_ORIGINS=*` is rejected when Braiins is configured or in production.
- CORS remains an additional browser restriction, not the security boundary.
  Normal production browser traffic reaches Forge through the Netlify `/api/*`
  proxy (same-origin), not direct frontend→Render XHR. Keep the exact Netlify
  origin in `CORS_ORIGINS` as defense in depth for any direct access attempts.
  Anonymous access to protected telemetry endpoints remains blocked by Forge auth.

### Miner ↔ worker cardinality

Braiins operational mapping is **one physical miner ↔ one worker**. Mapped assets
must use `quantity: 1`. Grouped inventory (`quantity > 1`) is allowed only when
unmapped. Bulk import can come later without compromising health/economics math.

### Partial Braiins outages

`fetchMiningSummary` resolves profile / workers / rewards / payouts independently.
A payouts or rewards failure does not erase worker telemetry. The API returns
`sources: { profile, workers, rewards, payouts }` with per-source `ok` / `error` /
`stale`, and keeps last-known-good cache where available.

### LIVE vs MANUAL vs MODELED vs DERIVED

- **LIVE** — Braiins workers/rewards/payouts; CoinGecko BTC spot; mempool.space hashrate/difficulty/height
- **MANUAL** — miner assets, facilities, treasury transactions, liabilities, assumptions
- **MODELED** — unit economics, pool fee, uptime, calculator scenarios; fallback market/network
- **DERIVED** — NAV, mining revenue/profit, allocation shares (inspectable dependencies)

## Deployment

Production request flow:

```text
Browser
  → https://forge-energy-and-compute.netlify.app/api/*
  → Netlify rewrite (status 200)
  → Render forge-api /api/*
  → Braiins Pool (server-side token only)
```

### Render API

`render.yaml` defines the `forge-api` Node web service with
`server/` as its root, `/api/health` as its health check, and
`0.0.0.0:$PORT` binding in the application.

1. Create/sync the Render Blueprint.
2. Set `BRAIINS_API_TOKEN` as a secret environment variable.
3. Set `FORGE_OPERATOR_PASSWORD` and `FORGE_SESSION_SECRET` (required in
   production whenever Braiins is enabled).
4. Leave `FORGE_COOKIE_SAMESITE=lax` (Blueprint default) for the Netlify proxy path.
5. Set `CORS_ORIGINS` to the exact Netlify production URL and any approved
   preview/custom-domain origins, comma-separated. Do not use `*`.
6. Confirm `/api/health` returns `ok: true`, then sign in from the UI before
   expecting live telemetry.

The service filesystem is not used for persistent data.

### Netlify frontend

`netlify.toml` builds the Vite app to `dist/`, proxies `/api/*` to Render, then
falls back to the SPA.

1. Connect the repository in Netlify.
2. In `netlify.toml`, set the `/api/*` rewrite `to` host to your public Render
   `forge-api` origin (keep `/api/:splat`). Example:
   `https://forge-api.onrender.com/api/:splat`. Update this whenever the Render
   public URL changes. Do not put secrets in `netlify.toml`.
3. Do **not** set `VITE_FORGE_API_BASE_URL` for normal production — the browser
   must call same-origin `/api/...`. Use that variable only for preview/local
   overrides that talk to Forge directly.
4. Deploy, then ensure Render `CORS_ORIGINS` includes the Netlify site origin.

## Scripts and verification

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite frontend |
| `npm run lint` | Lint frontend code |
| `npm run typecheck` | Type-check frontend code |
| `npm run test` | Run frontend unit tests |
| `npm run build` | Type-check and build the frontend |
| `npm run server:dev` | Start Forge API with watch mode |
| `npm run server:lint` | Lint Forge API |
| `npm run server:typecheck` | Type-check Forge API |
| `npm run server:test` | Run Forge API tests |
| `npm run server:build` | Build Forge API to `server/dist/` |

Fleet inventory and treasury values are currently browser-local. Clearing site
storage removes them, and they do not synchronize across operators or devices.
