import { resolve } from "node:path"
import { composeDatabase, restore } from "./backup.ts"

/** `pnpm db:restore <file>`: restores a `pnpm db:backup` dump into an empty database. */
const file = process.argv[2]
if (file === undefined) {
  console.error("Usage: pnpm db:restore <backup file>")
  process.exitCode = 1
} else {
  try {
    await restore(composeDatabase, resolve(file))
    console.log(`Restored ${file}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
