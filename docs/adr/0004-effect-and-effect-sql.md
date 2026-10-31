---
status: accepted
---

# Effect 4, with Effect's own SQL client instead of an ORM

We use Effect 4 in two ways. In `packages/core` it serves as a standard library: only its pure modules (`Result`, `Option`, `Data`, `Brand`, `Match`, `Schema`, `Order`, `Equivalence`), so core functions stay plain synchronous functions and never return `Effect<…>`. In `apps/web` it is used fully, for application services, Layers, typed error channels and transactions. For v1 alone, a local `Result` type would have covered most of the benefit. We chose Effect deliberately: one toolkit for typed errors, decoding and dependency injection, and a foundation for later Open Banking sync and scheduled jobs, where retries, schedules and resources matter.

Once Effect was chosen, Drizzle was dropped in favour of `effect/sql` with `@effect/sql-pg`. The official Drizzle integration supports only Effect 3. Wrapping Drizzle by hand would have meant two schema definitions (Drizzle tables plus Effect Schema) and glue code to pass transactions around. With `effect/sql`, row Schemas decode straight into domain types (`bigint` cents → `Money`, `date` → `PlainDate`), and `sql.withTransaction` puts every query of an Import or undo in one transaction without passing a handle around. We accept losing compile-time column checking (integration tests against real Postgres cover every repository) and generated migrations (migrations are handwritten SQL, run by Effect's `Migrator`).

## Consequences

- Effect Schema replaces Zod everywhere: TanStack Start validators through Standard Schema, and Effect `Config` for environment variables.
- Expected failures are typed errors (`Data.TaggedError` in `Result` or the error channel). Broken invariants throw. A Balance Discrepancy or an uncertain classification is normal output, not an error.
- One `ManagedRuntime` is built from the application Layers at server start. Routes call `runtime.runPromise(service(...))` through a shared helper that maps typed errors to responses. Routes contain no other Effect code.
- Effect 4 shipped in October 2026, so agents tend to write v3 APIs (`Either`, `@effect/schema`). Code rules in `AGENTS.md` keep them on v4.
