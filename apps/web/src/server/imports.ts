import {
  AccountId,
  ImportId,
  InvalidImport,
  Money,
  OwnerId,
  fingerprintLines,
  maxImportMegabytes,
  parseStatement,
  statementTotals,
} from "@ballast/core"
import type { Import, ImportProblem } from "@ballast/core"
import { Array as Arr, Effect, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { getAccount } from "./accounts.ts"
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
  readonly importId: ImportId
  readonly fileName: string
  readonly lineCount: number
  readonly firstDate: Temporal.PlainDate
  readonly lastDate: Temporal.PlainDate
  /** The sum of the lines that brought money in. */
  readonly moneyIn: Money.Money
  /** The sum of the lines that took money out: negative. */
  readonly moneyOut: Money.Money
  /** The export's Balance Checkpoint: the bank's balance after the newest line. Not stored yet. */
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
  importedAt: Schema.Date,
})

const importColumns = `id, owner_id AS "ownerId", account_id AS "accountId", file_name AS "fileName",
  format, line_count AS "lineCount", imported_at AS "importedAt"`

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
 * statement line becomes a Transaction recording this Import. All or
 * nothing: any problem with the file, any line already imported into the
 * Account, or an Archived Account fails with `InvalidImport` naming every
 * problem, and nothing is stored. Fails with `AccountNotFound` when the
 * Account isn't the Owner's.
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
    const existing = new Set(
      (yield* sql<{ fingerprint: string }>`
        SELECT fingerprint FROM transaction
        WHERE owner_id = ${ownerId} AND account_id = ${account.id}
          AND fingerprint IN ${sql.in(fingerprints)}
      `).map((row) => row.fingerprint),
    )
    const repeated = statement.lines.filter((_, index) => existing.has(fingerprints[index] ?? ""))
    if (repeated.length > 0) {
      return yield* reject(
        ...repeated
          .map((line) => ({ row: line.row, problem: "already_imported" as const }))
          .toSorted((a, b) => a.row - b.row),
      )
    }

    const fileName = baseName(file.name)
    const recorded = yield* sql
      .withTransaction(
        Effect.gen(function* () {
          const [row] = yield* sql<{ id: string }>`
            INSERT INTO import (owner_id, account_id, file_name, format, line_count)
            VALUES (${ownerId}, ${account.id}, ${fileName}, ${statement.format},
                    ${statement.lines.length})
            RETURNING id
          `
          if (row === undefined) return yield* Effect.die("INSERT … RETURNING gave no row")
          yield* sql`
            INSERT INTO transaction ${sql.insert(
              Arr.map(statement.lines, (line, index) => ({
                owner_id: ownerId,
                account_id: account.id,
                date: line.date.toString(),
                amount_cents: line.amount.cents.toString(),
                description: line.description,
                description_key: line.descriptionKey,
                source: "import",
                import_id: row.id,
                fingerprint: fingerprints[index] ?? null,
              })),
            )}
          `
          return row.id
        }),
      )
      .pipe(Effect.flatMap(Schema.decodeUnknownEffect(ImportId)), Effect.orDie)

    const { balance } = yield* getAccount(ownerId, account.id)
    const [first] = statement.lines
    const last = Arr.lastNonEmpty(statement.lines)
    const summary: ImportSummary = {
      importId: recorded,
      fileName,
      lineCount: statement.lines.length,
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
    const imports: readonly Import[] = yield* Schema.decodeUnknownEffect(Schema.Array(ImportRow))(
      rows,
    ).pipe(Effect.orDie)
    return imports
  })

export const importStatementForCurrentOwner = (accountId: string, file: ImportFile) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* importStatement(owner.id, accountId, file)
  })
