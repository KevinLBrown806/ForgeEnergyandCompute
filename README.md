# Forge Energy & Compute

The operating dashboard for a private Bitcoin mining and energy company —
a single-page executive command center for the strategy:

**Energy → Compute → Bitcoin → Treasury**

Built with Vite, React, and TypeScript. No backend, database, or auth — all
figures come from a centralized, editable mock-data layer.

## Getting started

```bash
npm ci        # install exact, locked dependencies
npm run dev   # start the dev server on http://localhost:5173
```

The dev server binds to `0.0.0.0` and honors the `PORT` environment variable.

## Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the Vite dev server (HMR).             |
| `npm run build`     | Type-check (`tsc -b`) and build to `dist/`.  |
| `npm run preview`   | Serve the production build locally.          |
| `npm run lint`      | Lint with oxlint.                            |
| `npm run typecheck` | Type-check without emitting.                 |
| `npm run test`      | Run the unit tests with Vitest.              |

## Editing the data

All dashboard figures live in one file — **`src/config/forge.config.ts`**.
Change BTC holdings, miner quantities, electricity prices, capital allocation,
the roadmap, etc. there without touching any UI component. When a real API is
added later, replace the exported values with fetched data of the same shape.

## Project layout

```
src/
  config/forge.config.ts   # Single source of truth for all mock data
  lib/
    mining.ts              # Mining economics + fleet aggregation (pure)
    treasury.ts            # Treasury valuation & projections (pure)
    estimator.ts           # Shared energy/carbon math (reused by mining)
    format.ts              # Display formatters
    *.test.ts              # Unit tests for the calculation logic
  components/              # Dashboard UI (StatCard, charts, calculator, ...)
  App.tsx                 # Single-page dashboard composition
```

Business calculations are pure TypeScript in `src/lib` and covered by unit
tests, so the numbers can be verified independently of the UI.

## Dashboard sections

Overview · Treasury · Mining · Energy · Capital · Strategy — anchored sections
on one page, with a live mining economics calculator and local charts.

## Cloud Agent environment

`.cursor/environment.json` configures the Cursor Cloud Agent environment:
`npm ci` installs dependencies, and the dev server runs in a persistent
terminal on port 5173.
