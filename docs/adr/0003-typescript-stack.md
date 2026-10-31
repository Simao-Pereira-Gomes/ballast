---
status: accepted
---

# One full-stack TanStack Start app over a pure core package

Ballast is a single TanStack Start (React) app on Node LTS, in a pnpm workspace with two packages: `packages/core`, which holds all financial logic as pure modules, and `apps/web`, which holds routes, application services, persistence and the UI. We rejected a separate API plus SPA because Ballast has one Owner and one client, so a second deployable and an HTTP contract would add cost to every ticket for a mobile app that would first need hosting and authentication anyway. Instead we keep the extraction cheap: routes (loaders and server functions) only call application services, so a JSON API later is a second set of thin routes over the same services.

## Considered Options

- **Separate API (Hono) + Vite SPA**: an explicit API boundary from day one, rejected for v1 because the boundary that protects the valuable code is core/shell, not API/UI.
- **SvelteKit**: the safest framework option, passed over in favour of TanStack Start's end-to-end typing and the React ecosystem.
- **SolidStart**: rejected because agents writing it without supervision often break its reactivity, and its ecosystem is the smallest.
- **Bun**: rejected for Node, which is the most-used runtime for Postgres and test tooling.

## Consequences

- `packages/core` has no runtime dependencies except `effect` (ADR 0004), and its tsconfig leaves out Node types, so I/O in the core doesn't type-check.
- Calendar dates are `Temporal.PlainDate` (native in Node) and Postgres `date`. JavaScript `Date` is only for technical timestamps.
- UI: Tailwind v4, shadcn/ui, TanStack Table, Recharts.
- Tests: Vitest, `fast-check` for Money and Ledger Ingest invariants, Testcontainers Postgres for integration tests, Playwright for the smoke test.
- Code quality: typescript-eslint `strict-type-checked` with Prettier; `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax`.
- Owner scoping is enforced in application code, plus composite `(owner_id, …)` foreign keys from the first migration. Postgres RLS waits until authentication and hosting are added.
