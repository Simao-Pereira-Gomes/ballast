import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { DatabaseLive } from "./database.ts"
import { migrate } from "./migrate.ts"

/** `pnpm db:migrate`: applies pending migrations. The app also does this on start. */
const program = migrate.pipe(
  Effect.tap((applied) =>
    applied.length === 0
      ? Console.log("Database is up to date.")
      : Console.log(`Applied: ${applied.map(([id, name]) => `${id}_${name}`).join(", ")}`),
  ),
  Effect.provide(DatabaseLive),
)

NodeRuntime.runMain(program)
