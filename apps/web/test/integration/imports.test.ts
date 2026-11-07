import { Money } from "@ballast/core"
import type { OwnerId } from "@ballast/core"
import { layer } from "@effect/vitest"
import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { assert, expect } from "vitest"
import { archiveAccount, createAccount, getAccount } from "../../src/server/accounts.ts"
import { importStatement, listImports, maxImportBytes } from "../../src/server/imports.ts"
import { createOwner } from "../../src/server/owners.ts"
import {
  addManualTransaction,
  deleteTransaction,
  editManualTransaction,
  listTransactions,
} from "../../src/server/transactions.ts"
import { TestDatabase } from "./database.ts"
import { english, portuguese, portugueseWith, workbookOf } from "./workbooks.ts"

const openCurrentAccount = (owner: OwnerId) =>
  createAccount(owner, { name: "Santander", role: "operating_cash", currency: "EUR" })

const santanderFile = { name: "movimentos-setembro.xls", bytes: workbookOf(portuguese) }

const problemsOf = (error: { readonly _tag: string }) => {
  assert(error._tag === "InvalidImport" && "problems" in error)
  return error.problems
}

layer(TestDatabase)("Santander Import", (it) => {
  it.effect("turns every statement line into a Transaction and summarises the Import", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)

      const summary = yield* importStatement(owner, account.id, santanderFile)

      expect(summary).toMatchObject({
        fileName: "movimentos-setembro.xls",
        lineCount: 19,
        // 1850 + 40 + 19.99 + 120 + 0.03
        moneyIn: Money.eur(203002n),
        // 1004.00 − 412.35 opening balance − 2030.02 in
        moneyOut: Money.eur(-143837n),
        balanceCheckpoint: Money.eur(100400n),
        // The Account was empty, so its balance is what this export moved.
        accountBalance: Money.eur(59165n),
      })
      expect(summary.firstDate.toString()).toBe("2026-09-01")
      expect(summary.lastDate.toString()).toBe("2026-09-30")

      const transactions = yield* listTransactions(owner, account.id)
      expect(transactions).toHaveLength(19)
      expect(
        transactions.every((t) => t.source === "import" && t.importId === summary.importId),
      ).toBe(true)
      expect(transactions[0]).toMatchObject({
        amount: Money.eur(3n),
        description: "Juros Credores",
      })
      expect(transactions[0]?.date.toString()).toBe("2026-09-30")
      expect((yield* getAccount(owner, account.id)).balance).toEqual(Money.eur(59165n))
    }),
  )

  it.effect("records the Import's file name, Account, time and line count", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const before = new Date()

      const summary = yield* importStatement(owner, account.id, santanderFile)

      const [recorded, ...others] = yield* listImports(owner, account.id)
      assert(recorded !== undefined)
      expect(others).toEqual([])
      expect(recorded).toMatchObject({
        id: summary.importId,
        ownerId: owner,
        accountId: account.id,
        fileName: "movimentos-setembro.xls",
        format: "santander",
        lineCount: 19,
      })
      expect(recorded.importedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
    }),
  )

  it.effect("keeps two identical lines as two Transactions", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)

      yield* importStatement(owner, account.id, santanderFile)

      const bakery = (yield* listTransactions(owner, account.id)).filter(
        (t) => t.description === "Compra Padaria Central",
      )
      expect(bakery).toHaveLength(2)
    }),
  )

  it.effect("reads an export from the English site and an .xlsx file alike", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)

      const summary = yield* importStatement(owner, account.id, {
        name: "movements.xlsx",
        bytes: workbookOf(english, "xlsx"),
      })

      expect(summary.lineCount).toBe(19)
    }),
  )

  it.effect("rejects a malformed file with every problem named, and imports nothing", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const broken = portugueseWith({
        7: ["30-09-2026", "30-09-2026", "Juros Credores", "0", "1004"],
        9: ["31-09-2026", "25-09-2026", "Trf. MB WAY para Rui Exemplo Costa", "-15", "1503.97"],
      })

      const error = yield* Effect.flip(
        importStatement(owner, account.id, { name: "broken.xls", bytes: workbookOf(broken) }),
      )

      expect(problemsOf(error)).toEqual([
        { row: 8, problem: "zero_amount" },
        { row: 8, problem: "balance_mismatch" },
        { row: 10, problem: "invalid_date" },
      ])
      expect(yield* listTransactions(owner, account.id)).toEqual([])
      expect(yield* listImports(owner, account.id)).toEqual([])
    }),
  )

  it.effect("rejects a file in a layout it doesn't know, naming the headers it found", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const other = workbookOf({
        sheetName: "Export",
        rows: [
          ["Date", "Details", "Amount"],
          ["2026-09-01", "Coffee", "-1.2"],
        ],
      })

      const error = yield* Effect.flip(
        importStatement(owner, account.id, { name: "other-bank.xlsx", bytes: other }),
      )

      expect(problemsOf(error)).toEqual([
        { problem: "unrecognised_layout", headers: ["Date", "Details", "Amount"] },
      ])
    }),
  )

  it.effect("rejects a file that isn't a spreadsheet export", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)

      const pdf = yield* Effect.flip(
        importStatement(owner, account.id, { name: "extrato.pdf", bytes: new Uint8Array([1]) }),
      )
      const corrupt = yield* Effect.flip(
        importStatement(owner, account.id, {
          name: "extrato.xlsx",
          bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]),
        }),
      )
      const huge = yield* Effect.flip(
        importStatement(owner, account.id, {
          name: "extrato.xls",
          bytes: new Uint8Array(maxImportBytes + 1),
        }),
      )

      expect(problemsOf(pdf)).toEqual([{ problem: "unsupported_file" }])
      expect(problemsOf(corrupt)).toEqual([{ problem: "unreadable_file" }])
      expect(problemsOf(huge)).toEqual([{ problem: "file_too_large" }])
    }),
  )

  it.effect("rejects a file whose lines are already imported, and imports nothing more", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      yield* importStatement(owner, account.id, santanderFile)

      const error = yield* Effect.flip(importStatement(owner, account.id, santanderFile))

      const problems = problemsOf(error)
      expect(problems).toHaveLength(19)
      expect(problems).toContainEqual({ row: 8, problem: "already_imported" })
      expect(yield* listTransactions(owner, account.id)).toHaveLength(19)
      expect(yield* listImports(owner, account.id)).toHaveLength(1)
    }),
  )

  it.effect("imports the same export into two different Accounts", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const first = yield* openCurrentAccount(owner)
      const second = yield* createAccount(owner, {
        name: "Joint",
        role: "operating_cash",
        currency: "EUR",
      })

      yield* importStatement(owner, first.id, santanderFile)
      const summary = yield* importStatement(owner, second.id, santanderFile)

      expect(summary.lineCount).toBe(19)
    }),
  )

  it.effect("rejects an Import into an Archived Account", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      yield* archiveAccount(owner, account.id)

      const error = yield* Effect.flip(importStatement(owner, account.id, santanderFile))

      expect(problemsOf(error)).toEqual([{ problem: "account_archived" }])
      expect(yield* listTransactions(owner, account.id)).toEqual([])
    }),
  )

  it.effect("an imported Transaction can be deleted but not edited", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      yield* importStatement(owner, account.id, santanderFile)
      const [newest, ...rest] = yield* listTransactions(owner, account.id)
      assert(newest !== undefined)

      const editError = yield* Effect.flip(
        editManualTransaction(owner, newest.id, {
          date: "2026-09-30",
          amount: "1",
          direction: "inflow",
          description: "Changed",
        }),
      )
      yield* deleteTransaction(owner, newest.id)

      expect(editError._tag).toBe("TransactionNotFound")
      expect(yield* listTransactions(owner, account.id)).toEqual(rest)
    }),
  )

  it.effect("stores the normalised description beside the bank's text", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      yield* importStatement(owner, account.id, santanderFile)
      yield* addManualTransaction(owner, account.id, {
        date: "2026-10-01",
        amount: "2",
        direction: "outflow",
        description: "  Café   CENTRAL ",
      })

      const sql = yield* SqlClient
      const rows = yield* sql<{ description: string; descriptionKey: string }>`
        SELECT description, description_key AS "descriptionKey" FROM transaction
        WHERE owner_id = ${owner} AND description IN ('Juros Credores', 'Café   CENTRAL')
        ORDER BY description
      `
      expect(rows).toEqual([
        { description: "Café   CENTRAL", descriptionKey: "café central" },
        { description: "Juros Credores", descriptionKey: "juros credores" },
      ])
    }),
  )
})

layer(TestDatabase)("Owner scoping of Imports", (it) => {
  it.effect("an Owner can't import into another Owner's Account", () =>
    Effect.gen(function* () {
      const alice = yield* createOwner
      const bob = yield* createOwner
      const account = yield* openCurrentAccount(alice)

      const error = yield* Effect.flip(importStatement(bob, account.id, santanderFile))

      expect(error._tag).toBe("AccountNotFound")
      expect(yield* listTransactions(alice, account.id)).toEqual([])
      expect(yield* listImports(bob, account.id)).toEqual([])
    }),
  )
})
