import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { PgClient } from "@effect/sql-pg"
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { Effect, Redacted } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createAccount } from "../../src/server/accounts.ts"
import { backup, restore, type DatabaseShell } from "../../src/server/backup.ts"
import { migrate } from "../../src/server/migrate.ts"
import { createOwner } from "../../src/server/owners.ts"
import { addManualTransaction } from "../../src/server/transactions.ts"

/** Runs the Postgres tools inside a Testcontainers database, as `docker compose exec` does for Ballast's. */
const shellOf = (container: StartedPostgreSqlContainer): DatabaseShell => [
  "docker",
  "exec",
  "-i",
  container.getId(),
]

const run = <A, E>(container: StartedPostgreSqlContainer, effect: Effect.Effect<A, E, SqlClient>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(PgClient.layer({ url: Redacted.make(container.getConnectionUri()) })),
    ),
  )

/** Every row of every table, so two databases can be compared. */
const snapshot = Effect.gen(function* () {
  const sql = yield* SqlClient
  const tables = yield* sql<{ name: string }>`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `
  const contents: Record<string, unknown> = {}
  for (const { name } of tables) {
    const [result] = yield* sql.unsafe<{ rows: unknown }>(
      `SELECT coalesce(json_agg(t ORDER BY t::text), '[]') AS rows FROM "${name}" t`,
    )
    contents[name] = result?.rows
  }
  return contents
})

const seed = Effect.gen(function* () {
  yield* migrate
  const owner = yield* createOwner
  const current = yield* createAccount(owner, {
    name: "Santander Current",
    role: "operating_cash",
    currency: "EUR",
  })
  yield* createAccount(owner, {
    name: "Credit card",
    role: "liability",
    currency: "EUR",
    interestRate: "18,5",
  })
  yield* addManualTransaction(owner, current.id, {
    date: "2026-10-28",
    amount: "1850",
    direction: "inflow",
    description: "Salário",
  })
  yield* addManualTransaction(owner, current.id, {
    date: "2026-10-30",
    amount: "1,20",
    direction: "outflow",
    description: "Café",
  })
})

describe("Backup and restore", () => {
  let source: StartedPostgreSqlContainer
  let target: StartedPostgreSqlContainer
  let directory: string

  beforeAll(async () => {
    ;[source, target] = await Promise.all([
      new PostgreSqlContainer("postgres:18-alpine").start(),
      new PostgreSqlContainer("postgres:18-alpine").start(),
    ])
    directory = await mkdtemp(join(tmpdir(), "ballast-backup-"))
    await run(source, seed)
  })

  afterAll(async () => {
    await Promise.all([source.stop(), target.stop()])
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it("restores a backup into an empty database with identical data", async () => {
    const file = await backup(shellOf(source), directory, new Date("2026-11-05T22:53:12.345Z"))

    expect(basename(file)).toBe("ballast-2026-11-05T22-53-12-345Z.dump")
    expect(await readdir(directory)).toEqual([basename(file)])

    await restore(shellOf(target), file)

    const restored = await run(target, snapshot)
    expect(restored).toEqual(await run(source, snapshot))
    expect(restored["transaction"]).toHaveLength(2)
    // The restored database is complete: no migration is pending and new rows can be added.
    expect(await run(target, migrate)).toEqual([])
    await run(target, createOwner)
  })

  it("refuses to restore into a database that already holds data", async () => {
    const file = await backup(shellOf(source), directory)

    await expect(restore(shellOf(source), file)).rejects.toThrow(/not empty/)
  })
})
