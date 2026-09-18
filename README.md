# Forge Energy & Compute

Forge is a mining operations dashboard for the strategy:

**Energy → Compute → Bitcoin → Treasury**

The React frontend maintains a local fleet registry, combines registered
inventory with Braiins Pool telemetry from the Forge API, and keeps the mining
calculator explicitly separated as a forecast/scenario tool.

## Architecture

- `src/domain/` — canonical fleet, worker, reward, payout, alert, and treasury
  DTOs plus pure matching/health/aggregation logic.
- `src/adapters/localStorage.ts` — browser persistence behind repository
  interfaces. Fleet and manual treasury values never masquerade as server data.
- `src/services/forgeApi.ts` — the only frontend path to pool telemetry.
- `server/` — Node/TypeScript Forge API. The Braiins token stays server-side.
- `src/lib/mining.ts` — the existing forecast/scenario calculator.

The default fleet and treasury are empty. Demo mode is opt-in and clearly
labeled; demo assets are not written to the operating registry.

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
`http://localhost:8787`. If the API is hosted elsewhere, set
`VITE_FORGE_API_BASE_URL` to its origin, without a trailing slash.

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
- `GET /api/mining/summary`
- `GET /api/braiins/stats`
- `GET /api/braiins/workers`
- `GET /api/braiins/rewards?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/braiins/payouts?from=YYYY-MM-DD&to=YYYY-MM-DD`

Runtime variables:

| Variable | Purpose |
| --- | --- |
| `BRAIINS_API_TOKEN` | Server-only Braiins access token |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `PORT` | API listen port (Render supplies this) |
| `RATE_LIMIT_PER_MINUTE` | Forge API per-client request limit |
| `BRAIINS_TIMEOUT_MS` | Optional upstream timeout override |
| `BRAIINS_REQUEST_INTERVAL_MS` | Optional upstream request-spacing override |
| `VITE_FORGE_API_BASE_URL` | Public Forge API origin used by the frontend |


## Authentication & production gate

CORS is **not** authentication. When `BRAIINS_API_TOKEN` is set, Forge requires an
operator session before serving `/api/mining/summary` or `/api/braiins/*`.

Architecture:

1. Operator signs in with `FORGE_OPERATOR_PASSWORD` via `POST /api/auth/login`.
2. Server sets an **HttpOnly** signed session cookie (`FORGE_SESSION_SECRET`).
3. Browser calls use `credentials: "include"`. No API password/token is placed in
   Vite env, JS bundles, `localStorage`, or query strings.
4. Do **not** create `VITE_FORGE_SECRET` or any `VITE_BRAIINS_*` variable.

Production fail-closed rules:

- If `BRAIINS_API_TOKEN` is set and `NODE_ENV=production`, startup refuses to boot
  unless both `FORGE_OPERATOR_PASSWORD` and `FORGE_SESSION_SECRET` are set.
- `CORS_ORIGINS=*` is rejected when Braiins is configured or in production.
- CORS remains an additional browser restriction, not the security boundary.

### Miner ↔ worker cardinality

Braiins operational mapping is **one physical miner ↔ one worker**. Mapped assets
must use `quantity: 1`. Grouped inventory (`quantity > 1`) is allowed only when
unmapped. Bulk import can come later without compromising health/economics math.

### Partial Braiins outages

`fetchMiningSummary` resolves profile / workers / rewards / payouts independently.
A payouts or rewards failure does not erase worker telemetry. The API returns
`sources: { profile, workers, rewards, payouts }` with per-source `ok` / `error` /
`stale`, and keeps last-known-good cache where available.

### ACTUAL vs DERIVED vs FORECAST

- **ACTUAL** — worker state, hashrates, shares, pool rewards, payouts, balances
- **DERIVED** — estimated revenue/cost/net from live hashrate (not settled revenue)
- **FORECAST** — Mining Calculator scenarios only

## Deployment

### Render API

`render.yaml` defines the `forge-api` Node web service with
`server/` as its root, `/api/health` as its health check, and
`0.0.0.0:$PORT` binding in the application.

1. Create/sync the Render Blueprint.
2. Set `BRAIINS_API_TOKEN` as a secret environment variable.
3. Set `FORGE_OPERATOR_PASSWORD` and `FORGE_SESSION_SECRET` (required in
   production whenever Braiins is enabled).
4. Set `CORS_ORIGINS` to the exact Netlify production URL and any approved
   preview/custom-domain origins, comma-separated. Do not use `*`.
5. Confirm `/api/health` returns `ok: true`, then sign in from the UI before
   expecting live telemetry.

The service filesystem is not used for persistent data.

### Netlify frontend

`netlify.toml` builds the Vite app to `dist/` and provides the SPA fallback.

1. Connect the repository in Netlify.
2. Set `VITE_FORGE_API_BASE_URL` to the Render API origin.
3. Deploy and add the resulting frontend origin to Render `CORS_ORIGINS`.

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
