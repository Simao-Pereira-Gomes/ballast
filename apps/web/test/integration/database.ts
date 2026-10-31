import { PgClient } from "@effect/sql-pg"
import { Redacted } from "effect"
import { inject } from "vitest"

/** A client for the migrated test database started in the global setup. */
export const TestDatabase = PgClient.layer({ url: Redacted.make(inject("databaseUrl")) })
