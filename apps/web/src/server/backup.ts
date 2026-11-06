import { Data, Effect, FileSystem, Path, type PlatformError, type Sink, Stream } from "effect"
import { ChildProcess } from "effect/process"

/**
 * How to run a program inside the Postgres container, with stdin attached. The container's own
 * `pg_dump`, `pg_restore` and `psql` are used, so they always match the server's version and
 * nothing needs installing on the host.
 */
export interface DatabaseShell {
  readonly command: string
  readonly args: ReadonlyArray<string>
}

/** The `db` service of Ballast's `docker compose` stack. */
export const composeDatabase: DatabaseShell = {
  command: "docker",
  args: ["compose", "exec", "-T", "db"],
}

export type DatabaseTool = "pg_dump" | "pg_restore" | "psql"

/** A Postgres tool exited with an error, e.g. because the database is not running. */
export class DatabaseToolFailed extends Data.TaggedError("DatabaseToolFailed")<{
  readonly tool: DatabaseTool
  readonly exitCode: number
  readonly stderr: string
}> {
  override get message() {
    return `${this.tool} failed (exit ${this.exitCode}): ${this.stderr}`
  }
}

/** Restore only writes into a database without tables, so it never mixes with or overwrites data. */
export class DatabaseNotEmpty extends Data.TaggedError("DatabaseNotEmpty")<{
  readonly tables: number
}> {
  override get message() {
    return `The database is not empty (${this.tables} tables). Restore only into a fresh database.`
  }
}

/** `ballast-2026-11-05T22-53-12-345Z.dump`: sortable, and free of characters some file systems reject. */
export const backupFileName = (at: Date) => `ballast-${at.toISOString().replace(/[:.]/g, "-")}.dump`

/**
 * Writes all of Ballast's data to a new timestamped dump (Postgres custom format) in `directory`
 * and returns its path. A failed backup leaves no file behind.
 */
export const backup = (shell: DatabaseShell, directory: string, at = new Date()) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* fs.makeDirectory(directory, { recursive: true })
    const file = path.join(directory, backupFileName(at))
    const partial = `${file}.partial`
    yield* runTool(shell, "pg_dump", ["--format=custom", "--no-owner", "--no-privileges"], {
      stdout: fs.sink(partial),
    }).pipe(Effect.onError(() => fs.remove(partial, { force: true }).pipe(Effect.ignore)))
    yield* fs.rename(partial, file)
    return file
  })

/** Restores a dump written by `backup` into an empty database, all or nothing. */
export const restore = (shell: DatabaseShell, file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const output = yield* runTool(shell, "psql", [
      "--tuples-only",
      "--no-align",
      "--command",
      "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'",
    ])
    const tables = Number(output.trim())
    if (tables !== 0) return yield* new DatabaseNotEmpty({ tables })
    return yield* runTool(
      shell,
      "pg_restore",
      ["--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction"],
      { stdin: fs.stream(file) },
    ).pipe(Effect.asVoid)
  })

/**
 * Runs a Postgres tool through the shell, connected to the container's database. Streams `stdin`
 * into the tool and its stdout into the `stdout` sink when given; otherwise returns stdout as text.
 */
const runTool = Effect.fnUntraced(function* (
  shell: DatabaseShell,
  tool: DatabaseTool,
  args: ReadonlyArray<string>,
  io: {
    readonly stdin?: Stream.Stream<Uint8Array, PlatformError.PlatformError>
    readonly stdout?: Sink.Sink<void, Uint8Array, never, PlatformError.PlatformError>
  } = {},
) {
  // The official Postgres image sets these for the database it creates. `sh` expands them inside
  // the container; the tool's own arguments follow as "$@", so they need no quoting.
  const script = `exec ${tool} -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"`
  const command = ChildProcess.make(
    shell.command,
    [...shell.args, "sh", "-c", script, tool, ...args],
    {
      stdin: io.stdin ?? "ignore",
    },
  )
  const [exitCode, stdout, stderr] = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* command
      return yield* Effect.all(
        [
          handle.exitCode,
          io.stdout
            ? Stream.run(handle.stdout, io.stdout).pipe(Effect.as(""))
            : Stream.mkString(Stream.decodeText(handle.stdout)),
          Stream.mkString(Stream.decodeText(handle.stderr)),
        ],
        { concurrency: "unbounded" },
      )
    }),
  )
  if (exitCode !== 0) {
    return yield* new DatabaseToolFailed({ tool, exitCode, stderr: stderr.trim() })
  }
  return stdout
})
