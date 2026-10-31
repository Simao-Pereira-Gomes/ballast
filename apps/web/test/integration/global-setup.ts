import { PgClient } from "@effect/sql-pg"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { Effect, Redacted } from "effect"
import type { TestProject } from "vitest/node"
import { migrate } from "../../src/server/migrate.ts"

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:18-alpine").start()
  const url = container.getConnectionUri()
  await Effect.runPromise(migrate.pipe(Effect.provide(PgClient.layer({ url: Redacted.make(url) }))))
  project.provide("databaseUrl", url)
  return async () => {
    await container.stop()
  }
}
