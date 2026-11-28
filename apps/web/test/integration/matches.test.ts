import { Money, accountBalance } from "@ballast/core"
import type { OwnerId, Transaction } from "@ballast/core"
import { layer } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { createAccount } from "../../src/server/accounts.ts"
import { listCheckpoints } from "../../src/server/checkpoints.ts"
import { importStatement, undoImport } from "../../src/server/imports.ts"
import { confirmMatch, listMatchSuggestions, rejectMatch } from "../../src/server/matches.ts"
import { createOwner } from "../../src/server/owners.ts"
import {
  addManualTransaction,
  deleteTransaction,
  listTransactions,
} from "../../src/server/transactions.ts"
import { TestDatabase } from "./database.ts"
import { portuguese, workbookOf } from "./workbooks.ts"

const openAccount = (owner: OwnerId) =>
  createAccount(owner, { name: "Santander", role: "operating_cash", currency: "EUR" })

const file = { name: "export.xls", bytes: workbookOf(portuguese) }

/** The Owner types in what an imported line already records, by default a day earlier. */
const enterManually = (
  owner: OwnerId,
  accountId: string,
  bank: Transaction,
  description = "Coffee with Ana",
  daysAfterBank = -1,
) =>
  addManualTransaction(owner, accountId, {
    date: bank.date.add({ days: daysAfterBank }).toString(),
    amount: Money.formatForInput(bank.amount, "en"),
    direction: bank.amount.cents < 0n ? "outflow" : "inflow",
    description,
  })

/** An Account with one Import, and its first imported Transaction. */
const importedAccount = (owner: OwnerId) =>
  Effect.gen(function* () {
    const account = yield* openAccount(owner)
    const result = yield* importStatement(owner, account.id, file)
    const [bank] = (yield* listTransactions(owner, account.id)).filter(
      (t) => t.importId === result.importId,
    )
    if (bank === undefined) return yield* Effect.die("the Import created no Transactions")
    return { account, importId: result.importId ?? "", bank }
  })

layer(TestDatabase)("Matches", (it) => {
  it.effect("suggests a manual entry for an imported Transaction, whichever came first", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      expect(yield* listMatchSuggestions(owner)).toEqual([])

      const manual = yield* enterManually(owner, account.id, bank)

      const suggestions = yield* listMatchSuggestions(owner)
      expect(
        suggestions.map((s) => ({
          manualId: s.manual.id,
          importedId: s.imported.id,
          daysApart: s.daysApart,
        })),
      ).toEqual([{ manualId: manual.id, importedId: bank.id, daysApart: 1 }])
    }),
  )

  it.effect("confirming leaves one Transaction: bank data plus the Owner's note", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      const before = yield* listTransactions(owner, account.id)
      const manual = yield* enterManually(owner, account.id, bank)

      yield* confirmMatch(owner, manual.id, bank.id)

      const after = yield* listTransactions(owner, account.id)
      expect(after).toHaveLength(before.length)
      expect(after.find((t) => t.id === manual.id)).toBeUndefined()
      expect(after.find((t) => t.id === bank.id)).toEqual({ ...bank, notes: "Coffee with Ana" })
      expect(yield* listMatchSuggestions(owner)).toEqual([])
    }),
  )

  it.effect("rejecting keeps both and the pair is not suggested again", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      const before = yield* listTransactions(owner, account.id)
      const manual = yield* enterManually(owner, account.id, bank)

      yield* rejectMatch(owner, manual.id, bank.id)

      expect(yield* listMatchSuggestions(owner)).toEqual([])
      expect(yield* listTransactions(owner, account.id)).toHaveLength(before.length + 1)
    }),
  )

  it.effect("confirming one candidate drops the other suggestions for either Transaction", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      const first = yield* enterManually(owner, account.id, bank, "First")
      const second = yield* enterManually(owner, account.id, bank, "Second")
      expect(yield* listMatchSuggestions(owner)).toHaveLength(2)

      yield* confirmMatch(owner, first.id, bank.id)

      expect(yield* listMatchSuggestions(owner)).toEqual([])
      const kept = yield* listTransactions(owner, account.id)
      expect(kept.some((t) => t.id === second.id)).toBe(true)
    }),
  )

  it.effect("undoing the Import restores the manual entry as the Owner typed it", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, importId, bank } = yield* importedAccount(owner)
      const manual = yield* enterManually(owner, account.id, bank)
      yield* confirmMatch(owner, manual.id, bank.id)

      yield* undoImport(owner, importId)

      const remaining = yield* listTransactions(owner, account.id)
      expect(remaining).toHaveLength(1)
      expect(remaining[0]).toMatchObject({
        source: "manual",
        importId: null,
        description: "Coffee with Ana",
        notes: null,
        date: manual.date,
        amount: manual.amount,
      })
    }),
  )

  it.effect("deleting a merged Transaction by hand does not bring the manual entry back", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, importId, bank } = yield* importedAccount(owner)
      const manual = yield* enterManually(owner, account.id, bank)
      yield* confirmMatch(owner, manual.id, bank.id)

      yield* deleteTransaction(owner, bank.id)
      yield* undoImport(owner, importId)

      expect(yield* listTransactions(owner, account.id)).toEqual([])
    }),
  )

  it.effect("keeps Matches to the Owner's own Transactions", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const stranger = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      const manual = yield* enterManually(owner, account.id, bank)

      expect(yield* listMatchSuggestions(stranger)).toEqual([])
      expect((yield* Effect.flip(confirmMatch(stranger, manual.id, bank.id)))._tag).toBe(
        "MatchNotFound",
      )
      expect((yield* Effect.flip(rejectMatch(stranger, manual.id, bank.id)))._tag).toBe(
        "MatchNotFound",
      )
      expect(yield* listMatchSuggestions(owner)).toHaveLength(1)
    }),
  )

  it.effect("only confirms a pair that is currently suggested", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      const manual = yield* enterManually(owner, account.id, bank)
      yield* rejectMatch(owner, manual.id, bank.id)

      expect((yield* Effect.flip(confirmMatch(owner, manual.id, bank.id)))._tag).toBe(
        "MatchNotFound",
      )
    }),
  )
  it.effect("confirming takes the Owner's entry out of the balance the bank already counts", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      const balance = () =>
        Effect.gen(function* () {
          const checkpoints = yield* listCheckpoints(owner, account.id)
          return accountBalance(checkpoints, yield* listTransactions(owner, account.id))
        })
      const bankBalance = yield* balance()
      // Typed in after the export's date, the entry is a double count until it is Matched.
      const manual = yield* enterManually(owner, account.id, bank, "Coffee", 1)
      expect(yield* balance()).toEqual(Money.add(bankBalance, manual.amount))

      yield* confirmMatch(owner, manual.id, bank.id)

      expect(yield* balance()).toEqual(bankBalance)
    }),
  )

  it.effect("lets only one of two simultaneous confirms through", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      const manual = yield* enterManually(owner, account.id, bank)

      const [first, second] = yield* Effect.all(
        [
          Effect.exit(confirmMatch(owner, manual.id, bank.id)),
          Effect.exit(confirmMatch(owner, manual.id, bank.id)),
        ],
        { concurrency: 2 },
      )

      expect([first._tag, second._tag].toSorted()).toEqual(["Failure", "Success"])
      expect(yield* listMatchSuggestions(owner)).toEqual([])
    }),
  )

  it.effect("lets only one of two simultaneous confirms for the same bank line through", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      const first = yield* enterManually(owner, account.id, bank, "First")
      const second = yield* enterManually(owner, account.id, bank, "Second")

      const results = yield* Effect.all(
        [
          Effect.exit(confirmMatch(owner, first.id, bank.id)),
          Effect.exit(confirmMatch(owner, second.id, bank.id)),
        ],
        { concurrency: 2 },
      )

      expect(results.filter((r) => r._tag === "Success")).toHaveLength(1)
      const kept = yield* listTransactions(owner, account.id)
      expect(kept.find((t) => t.id === bank.id)?.notes).toMatch(/^(First|Second)$/)
    }),
  )

  it.effect("lets only one of two simultaneous rejects through", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const { account, bank } = yield* importedAccount(owner)
      const manual = yield* enterManually(owner, account.id, bank)

      const [first, second] = yield* Effect.all(
        [
          Effect.exit(rejectMatch(owner, manual.id, bank.id)),
          Effect.exit(rejectMatch(owner, manual.id, bank.id)),
        ],
        { concurrency: 2 },
      )

      expect([first._tag, second._tag].toSorted()).toEqual(["Failure", "Success"])
      expect(yield* listMatchSuggestions(owner)).toEqual([])
    }),
  )

  it.effect("treats a malformed id as a pair that isn't suggested", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner

      expect((yield* Effect.flip(confirmMatch(owner, "nope", "also-nope")))._tag).toBe(
        "MatchNotFound",
      )
      expect((yield* Effect.flip(rejectMatch(owner, "nope", "also-nope")))._tag).toBe(
        "MatchNotFound",
      )
    }),
  )
})
