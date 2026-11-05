import { resolve } from "node:path"
import { backup, composeDatabase } from "./backup.ts"

try {
  const file = await backup(composeDatabase, resolve(process.argv[2] ?? "backups"))
  console.log(`Backed up to ${file}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
