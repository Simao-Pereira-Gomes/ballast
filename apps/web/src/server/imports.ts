import {
  AccountId,
  ImportId,
  ImportNotFound,
  InvalidImport,
  Money,
  OwnerId,
  fingerprintLines,
  separateNewLines,
  maxImportMegabytes,
  parseStatement,
  statementTotals,
} from "@ballast/core"
import type { Import, ImportProblem } from "@ballast/core"
import { Array as Arr, Effect, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { getAccount } from "./accounts.ts"
import { recordCheckpoint } from "./checkpoints.ts"
import { CurrentOwner } from "./owners.ts"
import { decodeSpreadsheet } from "./spreadsheet.ts"

/** A bank export as uploaded: its file name and contents. */
export interface ImportFile {
  readonly name: string
  readonly bytes: Uint8Array
}

/** The largest export accepted, in bytes. */
export const maxImportBytes = maxImportMegabytes * 1024 * 1024

/** The file extensions of the exports Ballast reads (ADR 0005). */
export const importExtensions = [".xls", ".xlsx"] as const

/** What the Owner is told after an Import. */
export interface ImportSummary {
  /** The Import recorded, or `null` when every line was already imported. */
  readonly importId: ImportId | null
  readonly fileName: string
  /** Lines in the file. */
  readonly lineCount: number
  /** Lines that became Transactions. */
  readonly newCount: number
  /** Lines the Account already held, left out. */
  readonly skippedCount: number
  readonly firstDate: Temporal.PlainDate
  readonly lastDate: Temporal.PlainDate
  /** The sum of the file's lines that brought money in. */
  readonly moneyIn: Money.Money
  /** The sum of the file's lines that took money out: negative. */
  readonly moneyOut: Money.Money
  /** The export's Balance Checkpoint: the bank's balance after the newest line. Recorded with the Import. */
  readonly balanceCheckpoint: Money.Money
  /** The Account's balance from its Transactions, after the Import. */
  readonly accountBalance: Money.Money
}

const ImportRow = Schema.Struct({
  id: ImportId,
  ownerId: OwnerId,
  accountId: AccountId,
  fileName: Schema.String,
  format: Schema.String,
  lineCount: Schema.Number,
  skippedCount: Schema.Number,
  importedAt: Schema.Date,
})

const importColumns = `id, owner_id AS "ownerId", account_id AS "accountId", file_name AS "fileName",
  format, line_count AS "lineCount", skipped_count AS "skippedCount", imported_at AS "importedAt"`

const reject = (...problems: readonly ImportProblem[]) =>
  Effect.fail(new InvalidImport({ problems }))

/** The file's name without any folder a browser may send, trimmed. */
const baseName = (name: string) => name.split(/[\\/]/).at(-1)?.trim() ?? ""

const checkFile = (file: ImportFile) => {
  const name = baseName(file.name).toLowerCase()
  if (!importExtensions.some((extension) => name.endsWith(extension))) {
    return reject({ problem: "unsupported_file" })
  }
  if (file.bytes.byteLength > maxImportBytes) return reject({ problem: "file_too_large" })
  return Effect.void
}

/**
 * Imports a bank export into one of the Owner's active Accounts: every
 * statement line the Account doesn't hold yet becomes a Transaction
 * recording this Import; lines it already holds are skipped, so overlapping
 * exports never double-count. All or nothing: any problem with the file or
 * an Archived Account fails with `InvalidImport` naming every problem, and
 * nothing is stored. When every line is already imported no Import is
 * recorded, but the export's Balance Checkpoint still is. Fails with `AccountNotFound` when the Account isn't the Owner's.
 */
export const importStatement = (ownerId: OwnerId, accountId: string, file: ImportFile) =>
  Effect.gen(function* () {
    const account = yield* getAccount(ownerId, accountId)
    if (account.archived) return yield* reject({ problem: "account_archived" })
    yield* checkFile(file)
    const grid = yield* decodeSpreadsheet(file.bytes)
    const statement = yield* Effect.fromResult(parseStatement(grid))
    const fingerprints = fingerprintLines(statement.lines)

    const sql = yield* SqlClient
    const known = new Set(
      (yield* sql<{ fingerprint: string }>`
        SELECT fingerprint FROM transaction
        WHERE owner_id = ${ownerId} AND account_id = ${account.id}
          AND fingerprint IN ${sql.in(fingerprints)}
      `).map((row) => row.fingerprint),
    )
    const { fresh, skipped } = separateNewLines(statement.lines, known)

    const fileName = baseName(file.name)
    const recorded = yield* sql
      .withTransaction(
        Effect.gen(function* () {
          const importId = yield* Arr.match(fresh, {
            onEmpty: () => Effect.succeed(null),
            onNonEmpty: (newLines) =>
              Effect.gen(function* () {
                const [row] = yield* sql<{ id: string }>`
                  INSERT INTO import
                    (owner_id, account_id, file_name, format, line_count, skipped_count)
                  VALUES (${ownerId}, ${account.id}, ${fileName}, ${statement.format},
                          ${newLines.length}, ${skipped})
                  RETURNING id
                `
                if (row === undefined) return yield* Effect.die("INSERT … RETURNING gave no row")
                yield* sql`
                  INSERT INTO transaction ${sql.insert(
                    Arr.map(newLines, ({ line, fingerprint }) => ({
                      owner_id: ownerId,
                      account_id: account.id,
                      date: line.date.toString(),
                      amount_cents: line.amount.cents.toString(),
                      description: line.description,
                      description_key: line.descriptionKey,
                      source: "import",
                      import_id: row.id,
                      fingerprint,
                    })),
                  )}
                `
                return yield* Schema.decodeUnknownEffect(ImportId)(row.id)
              }),
          })
          // The export states the bank's balance even when every line was already imported.
          yield* recordCheckpoint(ownerId, account.id, importId, statement.balanceCheckpoint)
          return importId
        }),
      )
      .pipe(Effect.orDie)

    const { balance } = yield* getAccount(ownerId, account.id)
    const [first] = statement.lines
    const last = Arr.lastNonEmpty(statement.lines)
    const summary: ImportSummary = {
      importId: recorded,
      fileName,
      lineCount: statement.lines.length,
      newCount: fresh.length,
      skippedCount: skipped,
      firstDate: first.date,
      lastDate: last.date,
      ...statementTotals(statement.lines),
      balanceCheckpoint: statement.balanceCheckpoint.balance,
      accountBalance: balance,
    }
    return summary
  })

/** The Imports into one of the Owner's Accounts, newest first. */
export const listImports = (ownerId: OwnerId, accountId: AccountId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const rows = yield* sql`
      SELECT ${sql.literal(importColumns)} FROM import
      WHERE owner_id = ${ownerId} AND account_id = ${accountId}
      ORDER BY imported_at DESC, id
    `
    const decoded = yield* Schema.decodeUnknownEffect(Schema.Array(ImportRow))(rows).pipe(
      Effect.orDie,
    )
    const imports: readonly Import[] = decoded.map((row) => ({
      id: row.id,
      ownerId: row.ownerId,
      accountId: row.accountId,
      fileName: row.fileName,
      format: row.format,
      lineCount: row.lineCount,
      skippedCount: row.skippedCount,
      importedAt: Temporal.Instant.fromEpochMilliseconds(row.importedAt.getTime()),
    }))
    return imports
  })

/**
 * Undoes one of the Owner's Imports: removes exactly the Transactions and
 * Balance Checkpoints it created, and the Import itself. Manual Transactions
 * and other Imports are untouched, and the same file can then be imported
 * again as a fresh Import. Fails with `ImportNotFound` when the Import isn't
 * the Owner's or was already undone.
 */
export const undoImport = (ownerId: OwnerId, importId: string) =>
  Effect.gen(function* () {
    const id = yield* Effect.fromOption(Schema.decodeUnknownOption(ImportId)(importId)).pipe(
      Effect.mapError(() => new ImportNotFound({ importId })),
    )
    const sql = yield* SqlClient
    const undone = yield* sql
      .withTransaction(
        Effect.gen(function* () {
          yield* sql`DELETE FROM balance_checkpoint WHERE owner_id = ${ownerId} AND import_id = ${id}`
          yield* sql`DELETE FROM transaction WHERE owner_id = ${ownerId} AND import_id = ${id}`
          return yield* sql`DELETE FROM import WHERE owner_id = ${ownerId} AND id = ${id} RETURNING id`
        }),
      )
      .pipe(Effect.orDie)
    if (undone.length === 0) yield* new ImportNotFound({ importId })
  })

export const undoImportForCurrentOwner = (importId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    yield* undoImport(owner.id, importId)
  })

export const importStatementForCurrentOwner = (accountId: string, file: ImportFile) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* importStatement(owner.id, accountId, file)
  })
