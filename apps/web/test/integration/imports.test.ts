import { Money } from "@ballast/core"
import type { OwnerId } from "@ballast/core"
import { layer } from "@effect/vitest"
import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { assert, expect } from "vitest"
import { archiveAccount, createAccount, getAccount } from "../../src/server/accounts.ts"
import { listCheckpoints } from "../../src/server/checkpoints.ts"
import { importStatement, listImports, maxImportBytes } from "../../src/server/imports.ts"
import { CurrentOwner, createOwner } from "../../src/server/owners.ts"
import {
  accountLedgerOfCurrentOwner,
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
        newCount: 19,
        skippedCount: 0,
        // 1850 + 40 + 19.99 + 120 + 0.03
        moneyIn: Money.eur(203002n),
        // 1004.00 − 412.35 opening balance − 2030.02 in
        moneyOut: Money.eur(-143837n),
        balanceCheckpoint: Money.eur(100400n),
        // The Account was empty and had no opening balance: the bank's figure is right.
        accountBalance: Money.eur(100400n),
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
      expect((yield* getAccount(owner, account.id)).balance).toEqual(Money.eur(100400n))
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

  it.effect("re-importing the same file adds nothing and records no Import", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      yield* importStatement(owner, account.id, santanderFile)

      const summary = yield* importStatement(owner, account.id, santanderFile)

      expect(summary).toMatchObject({
        importId: null,
        lineCount: 19,
        newCount: 0,
        skippedCount: 19,
        accountBalance: Money.eur(100400n),
      })
      expect(yield* listTransactions(owner, account.id)).toHaveLength(19)
      expect(yield* listImports(owner, account.id)).toHaveLength(1)
    }),
  )

  it.effect("an overlapping export adds only the lines outside the overlap", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      // Lines run newest first from row index 7: the first file holds the
      // newest 12 lines, the second the oldest 12, so 5 are in both.
      const head = portuguese.rows.slice(0, 7)
      const lines = portuguese.rows.slice(7).filter((row) => row.some((cell) => cell !== null))
      const newer = { ...portuguese, rows: [...head, ...lines.slice(0, 12)] }
      const older = { ...portuguese, rows: [...head, ...lines.slice(-12)] }

      const first = yield* importStatement(owner, account.id, {
        name: "newer.xls",
        bytes: workbookOf(newer),
      })
      const second = yield* importStatement(owner, account.id, {
        name: "older.xls",
        bytes: workbookOf(older),
      })

      expect(first).toMatchObject({ newCount: 12, skippedCount: 0 })
      expect(second).toMatchObject({ lineCount: 12, newCount: 7, skippedCount: 5 })
      expect(yield* listTransactions(owner, account.id)).toHaveLength(19)
      expect(second.accountBalance).toEqual(Money.eur(100400n))
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

      expect(summary.newCount).toBe(19)
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

/** The fixture's lines, newest first, as grid rows (rows 0–6 are the header). */
const head = portuguese.rows.slice(0, 7)
const lineRows = portuguese.rows.slice(7).filter((row) => row.some((cell) => cell !== null))
const fileOf = (name: string, from: number, to: number) => ({
  name,
  bytes: workbookOf({ ...portuguese, rows: [...head, ...lineRows.slice(from, to)] }),
})

layer(TestDatabase)("Balance Checkpoints", (it) => {
  // Oldest 7 lines (to 5 Sept), the 6 newest (15–30 Sept) and the 6 between (7–12 Sept).
  const oldest = fileOf("oldest.xls", 12, 19)
  const newest = fileOf("newest.xls", 0, 6)
  const between = fileOf("between.xls", 6, 12)

  const discrepanciesOf = (owner: OwnerId, accountId: string) =>
    Effect.gen(function* () {
      const { discrepancies } = yield* accountLedgerOfCurrentOwner(accountId).pipe(
        Effect.provideService(CurrentOwner, { id: owner }),
      )
      return discrepancies
    })

  it.effect("records the export's balance, and the Account's balance is the bank's", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)

      yield* importStatement(owner, account.id, santanderFile)

      const [checkpoint, ...others] = yield* listCheckpoints(owner, account.id)
      expect(others).toEqual([])
      expect(checkpoint?.date.toString()).toBe("2026-09-30")
      expect(checkpoint?.balance).toEqual(Money.eur(100400n))
      expect((yield* getAccount(owner, account.id)).balance).toEqual(Money.eur(100400n))
      expect(yield* discrepanciesOf(owner, account.id)).toEqual([])
    }),
  )

  it.effect("re-importing the same file leaves one Checkpoint and no Discrepancy", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      yield* importStatement(owner, account.id, santanderFile)
      yield* importStatement(owner, account.id, santanderFile)

      expect(yield* listCheckpoints(owner, account.id)).toHaveLength(1)
      expect(yield* discrepanciesOf(owner, account.id)).toEqual([])
    }),
  )

  it.effect("exports in date order, with nothing missing, show no Discrepancy", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)

      yield* importStatement(owner, account.id, oldest)
      yield* importStatement(owner, account.id, between)
      yield* importStatement(owner, account.id, newest)

      expect(yield* listCheckpoints(owner, account.id)).toHaveLength(3)
      expect(yield* discrepanciesOf(owner, account.id)).toEqual([])
      expect((yield* getAccount(owner, account.id)).balance).toEqual(Money.eur(100400n))
    }),
  )

  it.effect("shows a Discrepancy for a missing stretch, and clears it once imported", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      yield* importStatement(owner, account.id, oldest)
      yield* importStatement(owner, account.id, newest)

      const [found, ...others] = yield* discrepanciesOf(owner, account.id)
      expect(others).toEqual([])
      expect(found?.date.toString()).toBe("2026-09-30")
      expect(found?.stated).toEqual(Money.eur(100400n))
      // The six lines between 5 and 15 Sept moved −55.01 − 27.5 − 37.85 − 1.2 − 1.2 + 1850 = 1727.24.
      expect(found?.difference).toEqual(Money.eur(172724n))

      yield* importStatement(owner, account.id, between)

      expect(yield* discrepanciesOf(owner, account.id)).toEqual([])
    }),
  )

  it.effect("shows a Discrepancy for a duplicated Transaction, and clears it once deleted", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      yield* importStatement(owner, account.id, oldest)
      yield* importStatement(owner, account.id, between)
      yield* importStatement(owner, account.id, newest)
      const duplicate = yield* addManualTransaction(owner, account.id, {
        date: "2026-09-12",
        amount: "55.01",
        direction: "outflow",
        description: "Compra Gasolineira",
      })

      const [found] = yield* discrepanciesOf(owner, account.id)
      expect(found?.difference).toEqual(Money.eur(5501n))

      yield* deleteTransaction(owner, duplicate.id)

      expect(yield* discrepanciesOf(owner, account.id)).toEqual([])
    }),
  )
})
