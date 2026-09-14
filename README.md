# Forge Energy & Compute

Marketing site and interactive **cluster cost & carbon estimator** for a
sustainable GPU-compute provider. Built with Vite, React, and TypeScript.

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

## Project layout

```
src/
  App.tsx                 # Landing page composition
  components/Estimator.tsx# Interactive estimator UI
  lib/estimator.ts        # Pure cost/carbon calculation logic
  lib/estimator.test.ts   # Unit tests for the calculation logic
```

The estimator math lives in `src/lib/estimator.ts` as pure functions so it can
be unit-tested independently of the UI.

## Cloud Agent environment

`.cursor/environment.json` configures the Cursor Cloud Agent environment:
`npm ci` installs dependencies, and the dev server runs in a persistent
terminal on port 5173.
