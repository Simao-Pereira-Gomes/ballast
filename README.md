# Ballast

Personal finance tracker that answers one question: **how much of my money should stay in the bank as a safety reserve, and how much should I invest?**

Ballast imports bank exports, classifies Revenue and Expenses, forecasts the next 12 months, and applies a configurable Rule Set (Portuguese/EU guidance by default) through an Allocation Waterfall: Operating Cash → Starter Reserve → High-Interest Debt → Reserve Target → Investable Surplus.

> Ballast is the weight a ship carries so it can sail confidently. Whatever is beyond it is free to go to work.

## Status

Slice 1 (Ledger) in progress: the walking skeleton runs end to end. You can open Accounts and list them.

## Running Ballast

You need a Docker runtime (e.g. [OrbStack](https://orbstack.dev)).

```sh
docker compose up --build
```

Then open <http://127.0.0.1:3000>. Ballast and Postgres listen on `127.0.0.1` only. On start the app applies pending migrations and creates the default Owner. Data lives in the `pgdata` Docker volume.

## Developing

You need Node 26 (see `.nvmrc`) and pnpm 12 (`npm install -g pnpm`).

```sh
pnpm install
cp .env.example .env        # DATABASE_URL for the local Postgres
docker compose up -d db     # Postgres only
pnpm dev                    # app with hot reload on http://127.0.0.1:3000
```

| Command                             | What it does                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm typecheck`                    | TypeScript 7 across all packages                                               |
| `pnpm lint`                         | oxlint with type-aware rules (`oxlint-tsgolint`)                               |
| `pnpm format` / `pnpm format:check` | Prettier                                                                       |
| `pnpm test`                         | Unit and property tests (no database)                                          |
| `pnpm test:integration`             | Services against a throwaway Postgres (Testcontainers, needs Docker)           |
| `pnpm test:e2e`                     | Builds the app and runs the Playwright smoke test against a throwaway Postgres |
| `pnpm db:migrate`                   | Applies pending migrations to `DATABASE_URL`                                   |

The first `pnpm test:e2e` needs a browser: `pnpm --filter @ballast/web exec playwright install chromium`.

### Layout

- `packages/core`: pure domain logic (Money, Account rules). No I/O, and no dependency except `effect`.
- `apps/web`: TanStack Start app. `src/server` holds the application services, persistence, migrations and the Effect runtime. `src/server/functions` holds the server functions that routes call. `src/routes` and `src/ui` hold the pages.

The code rules are in [`AGENTS.md`](./AGENTS.md); the stack decisions are in ADRs 0003–0005.

## Documentation

- [`CONTEXT.md`](./CONTEXT.md): domain glossary (the ubiquitous language used in code, docs and issues)
- [`docs/adr/`](./docs/adr): architecture decision records
- [`docs/prd/`](./docs/prd): product requirements

## Privacy

Ballast is designed to run on your own machine. **Never commit bank exports or personal financial data**: `.gitignore` excludes common export formats and the `data/` / `imports/` folders. Test fixtures must be synthetic.
