import { resolve } from "node:path"
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { backup, composeDatabase, restore } from "./backup.ts"

/**
 * `pnpm db:backup [directory]` dumps all of Ballast's data, to `backups/` (git-ignored) by default.
 * `pnpm db:restore <file>` restores such a dump into an empty database.
 * Relative paths resolve from the repository root, where pnpm runs the root scripts
 * (`INIT_CWD`), not from this package.
 */
const [command, argument] = process.argv.slice(2)
const fromRepositoryRoot = (path: string) => resolve(process.env["INIT_CWD"] ?? process.cwd(), path)

const program = Effect.gen(function* () {
  if (command === "backup") {
    const file = yield* backup(composeDatabase, fromRepositoryRoot(argument ?? "backups"))
    return yield* Console.log(`Backed up to ${file}`)
  }
  if (command === "restore" && argument !== undefined) {
    yield* restore(composeDatabase, fromRepositoryRoot(argument))
    return yield* Console.log(`Restored ${argument}`)
  }
  return yield* Effect.fail(new Error("Usage: pnpm db:backup [directory] | pnpm db:restore <file>"))
})

NodeRuntime.runMain(
  program.pipe(
    Effect.catch((error) =>
      Console.error(error.message).pipe(Effect.andThen(Effect.sync(() => (process.exitCode = 1)))),
    ),
    Effect.provide(NodeServices.layer),
  ),
)
