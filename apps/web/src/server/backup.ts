import { spawn } from "node:child_process"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, rename, rm } from "node:fs/promises"
import { join } from "node:path"
import { pipeline } from "node:stream/promises"

/**
 * A command prefix that runs a program inside the Postgres container, with stdin attached.
 * The container's own `pg_dump` and `pg_restore` are used, so they always match the server's version
 * and nothing needs installing on the host.
 */
export type DatabaseShell = readonly string[]

/** The `db` service of Ballast's `docker compose` stack. */
export const composeDatabase: DatabaseShell = ["docker", "compose", "exec", "-T", "db"]

// The official Postgres image sets these for the database it creates; quoting keeps them literal for `sh`.
const connection = `-U "$POSTGRES_USER" -d "$POSTGRES_DB"`

/** `ballast-2026-11-05T22-53-12-345Z.dump`: sortable, and free of characters some file systems reject. */
export const backupFileName = (at: Date) => `ballast-${at.toISOString().replace(/[:.]/g, "-")}.dump`

/**
 * Writes all of Ballast's data to a new timestamped dump (Postgres custom format) in `directory`
 * and returns its path. A failed backup leaves no file behind.
 */
export const backup = async (shell: DatabaseShell, directory: string, at = new Date()) => {
  await mkdir(directory, { recursive: true })
  const file = join(directory, backupFileName(at))
  const partial = `${file}.partial`
  try {
    await runIn(shell, `pg_dump ${connection} --format=custom --no-owner --no-privileges`, {
      stdout: partial,
    })
    await rename(partial, file)
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
  return file
}

/**
 * Restores a dump written by `backup` into an empty database, all or nothing.
 * Refuses a database that already has tables, so a restore never mixes with or overwrites data.
 */
export const restore = async (shell: DatabaseShell, file: string) => {
  const tables = await runIn(
    shell,
    `psql ${connection} --tuples-only --no-align --command "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"`,
  )
  if (tables.trim() !== "0") {
    throw new Error(
      "The database is not empty. Restore only into a fresh database (see README, Backup and restore).",
    )
  }
  await runIn(
    shell,
    `pg_restore ${connection} --no-owner --no-privileges --exit-on-error --single-transaction`,
    { stdin: file },
  )
}

/**
 * Runs a `sh` script through the shell. Streams `stdin` from a file and `stdout` to one when given;
 * otherwise returns stdout. Rejects with the script's stderr if it fails.
 */
const runIn = async (
  shell: DatabaseShell,
  script: string,
  files: { readonly stdin?: string; readonly stdout?: string } = {},
) => {
  const [command, ...prefix] = shell
  if (command === undefined) throw new Error("The database shell is empty.")
  const child = spawn(command, [...prefix, "sh", "-c", script], {
    stdio: [files.stdin ? "pipe" : "ignore", "pipe", "pipe"],
  })
  const { stdin, stdout: output, stderr: errors } = child
  if (output === null || errors === null) throw new Error("The database shell has no output.")
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject)
    child.once("close", resolve)
  })
  let stderr = ""
  errors.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk))
  let stdout = ""
  const streams = [
    files.stdin && stdin ? pipeline(createReadStream(files.stdin), stdin) : undefined,
    files.stdout
      ? pipeline(output, createWriteStream(files.stdout))
      : output.setEncoding("utf8").forEach((chunk: string) => void (stdout += chunk)),
  ]
  // Settle everything first: when the program fails, its stderr explains more than a broken pipe.
  const [exit, ...piped] = await Promise.allSettled([exited, ...streams])
  if (exit.status === "rejected") throw exit.reason
  if (exit.value !== 0) {
    throw new Error(`${script.split(" ")[0]} failed (exit ${exit.value}): ${stderr.trim()}`)
  }
  for (const result of piped) if (result.status === "rejected") throw result.reason
  return stdout
}
