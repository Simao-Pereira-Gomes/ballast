import type { OwnerId } from "@ballast/core"
import { layer } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { createAccount } from "../../src/server/accounts.ts"
import { listCheckpoints } from "../../src/server/checkpoints.ts"
import { importStatement, listImports, undoImport } from "../../src/server/imports.ts"
import { createOwner } from "../../src/server/owners.ts"
import { addManualTransaction, listTransactions } from "../../src/server/transactions.ts"
import { TestDatabase } from "./database.ts"
import { portuguese, workbookOf } from "./workbooks.ts"

const openCurrentAccount = (owner: OwnerId) =>
  createAccount(owner, { name: "Santander", role: "operating_cash", currency: "EUR" })

// Two overlapping exports: the first holds the newest 12 lines, the second the oldest 12,
// so 5 lines are in both.
const head = portuguese.rows.slice(0, 7)
const lines = portuguese.rows.slice(7).filter((row) => row.some((cell) => cell !== null))
const newer = {
  name: "newer.xls",
  bytes: workbookOf({ ...portuguese, rows: [...head, ...lines.slice(0, 12)] }),
}
const older = {
  name: "older.xls",
  bytes: workbookOf({ ...portuguese, rows: [...head, ...lines.slice(-12)] }),
}

layer(TestDatabase)("Import history and undo", (it) => {
  it.effect("lists each Import with its new and skipped counts, newest first", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      yield* importStatement(owner, account.id, newer)
      yield* importStatement(owner, account.id, older)

      const history = yield* listImports(owner, account.id)

      expect(
        history.map(({ fileName, lineCount, skippedCount }) => ({
          fileName,
          newCount: lineCount,
          skippedCount,
        })),
      ).toEqual([
        { fileName: "older.xls", newCount: 7, skippedCount: 5 },
        { fileName: "newer.xls", newCount: 12, skippedCount: 0 },
      ])
    }),
  )

  it.effect("removes only that Import's Transactions and Checkpoints", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const first = yield* importStatement(owner, account.id, newer)
      const manual = yield* addManualTransaction(owner, account.id, {
        date: "2026-09-12",
        amount: "5.00",
        direction: "outflow",
        description: "Cash",
      })
      const checkpointsBefore = yield* listCheckpoints(owner, account.id)
      expect(checkpointsBefore).toHaveLength(1)

      yield* undoImport(owner, first.importId ?? "")

      const remaining = yield* listTransactions(owner, account.id)
      expect(remaining.map((t) => t.id)).toEqual([manual.id])
      expect(yield* listCheckpoints(owner, account.id)).toEqual([])
      expect(yield* listImports(owner, account.id)).toEqual([])
    }),
  )

  it.effect("undoing the earlier of two overlapping Imports keeps the later one's lines", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const first = yield* importStatement(owner, account.id, newer)
      const second = yield* importStatement(owner, account.id, older)

      yield* undoImport(owner, first.importId ?? "")

      const remaining = yield* listTransactions(owner, account.id)
      expect(remaining).toHaveLength(7)
      expect(remaining.every((t) => t.importId === second.importId)).toBe(true)
      expect((yield* listImports(owner, account.id)).map((i) => i.fileName)).toEqual(["older.xls"])
    }),
  )

  it.effect("undoing the later of two overlapping Imports keeps the earlier one's lines", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const first = yield* importStatement(owner, account.id, newer)
      const second = yield* importStatement(owner, account.id, older)

      yield* undoImport(owner, second.importId ?? "")

      const remaining = yield* listTransactions(owner, account.id)
      expect(remaining).toHaveLength(12)
      expect(remaining.every((t) => t.importId === first.importId)).toBe(true)
    }),
  )

  it.effect("lets the same file be imported afresh after its Import is undone", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const first = yield* importStatement(owner, account.id, newer)
      yield* undoImport(owner, first.importId ?? "")

      const again = yield* importStatement(owner, account.id, newer)

      expect(again).toMatchObject({ newCount: 12, skippedCount: 0 })
      expect(yield* listTransactions(owner, account.id)).toHaveLength(12)
      expect(yield* listCheckpoints(owner, account.id)).toHaveLength(1)
    }),
  )

  it.effect("fails with ImportNotFound for an Import already undone or another Owner's", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const stranger = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const { importId } = yield* importStatement(owner, account.id, newer)
      const id = importId ?? ""

      expect((yield* Effect.flip(undoImport(stranger, id)))._tag).toBe("ImportNotFound")
      expect(yield* listTransactions(owner, account.id)).toHaveLength(12)

      yield* undoImport(owner, id)
      expect((yield* Effect.flip(undoImport(owner, id)))._tag).toBe("ImportNotFound")
      expect((yield* Effect.flip(undoImport(owner, "not-an-id")))._tag).toBe("ImportNotFound")
    }),
  )

  it.effect("keeps each overlapping Import's own Checkpoint when the other is undone", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const first = yield* importStatement(owner, account.id, newer)
      const second = yield* importStatement(owner, account.id, older)
      const both = yield* listCheckpoints(owner, account.id)
      expect(both).toHaveLength(2)

      yield* undoImport(owner, second.importId ?? "")

      expect(yield* listCheckpoints(owner, account.id)).toEqual([
        both.find((c) => c.date.toString() === first.lastDate.toString()),
      ])
    }),
  )

  it.effect("removes a Checkpoint a later all-skipped export restated, with its Import", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const first = yield* importStatement(owner, account.id, newer)
      const again = yield* importStatement(owner, account.id, newer)
      expect(again.importId).toBeNull()
      expect(yield* listCheckpoints(owner, account.id)).toHaveLength(1)

      yield* undoImport(owner, first.importId ?? "")

      // The Checkpoint belongs to the Import that first stated it, so it goes with it.
      expect(yield* listCheckpoints(owner, account.id)).toEqual([])
    }),
  )
})
