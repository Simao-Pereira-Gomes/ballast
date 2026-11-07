import { Money } from "@ballast/core"
import type { OwnerId } from "@ballast/core"
import { layer } from "@effect/vitest"
import { Effect } from "effect"
import { assert, expect } from "vitest"
import { createAccount, getAccount, listAccounts } from "../../src/server/accounts.ts"
import { createOwner } from "../../src/server/owners.ts"
import {
  addManualTransaction,
  deleteTransaction,
  editManualTransaction,
  listTransactions,
} from "../../src/server/transactions.ts"
import { TestDatabase } from "./database.ts"

const openCurrentAccount = (owner: OwnerId) =>
  createAccount(owner, { name: "Current", role: "operating_cash", currency: "EUR" })

const coffee = { date: "2026-10-30", amount: "1,20", direction: "outflow", description: "Café" }
const salary = { date: "2026-10-28", amount: "1850", direction: "inflow", description: "Salário" }

layer(TestDatabase)("Manual Transactions", (it) => {
  it.effect("an added Transaction appears on its Account, marked manual", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)

      const transaction = yield* addManualTransaction(owner, account.id, coffee)

      expect(transaction).toMatchObject({
        ownerId: owner,
        accountId: account.id,
        amount: Money.eur(-120n),
        description: "Café",
        source: "manual",
      })
      expect(transaction.date.toString()).toBe("2026-10-30")
      expect(yield* listTransactions(owner, account.id)).toEqual([transaction])
    }),
  )

  it.effect("lists an Account's Transactions newest first", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const older = yield* addManualTransaction(owner, account.id, salary)
      const newer = yield* addManualTransaction(owner, account.id, coffee)

      expect(yield* listTransactions(owner, account.id)).toEqual([newer, older])
    }),
  )

  it.effect("rejects invalid details with every problem named, and adds nothing", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)

      const error = yield* Effect.flip(
        addManualTransaction(owner, account.id, { ...coffee, amount: "0", description: " " }),
      )

      assert(error._tag === "InvalidTransaction")
      expect(error.problems).toEqual([
        { field: "amount", problem: "zero" },
        { field: "description", problem: "required" },
      ])
      expect(yield* listTransactions(owner, account.id)).toEqual([])
    }),
  )

  it.effect("an edit replaces the date, amount, direction and description", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const transaction = yield* addManualTransaction(owner, account.id, coffee)

      const edited = yield* editManualTransaction(owner, transaction.id, {
        date: "2026-10-31",
        amount: "5",
        direction: "inflow",
        description: "Refund from a friend",
      })

      expect(edited).toMatchObject({
        id: transaction.id,
        amount: Money.eur(500n),
        description: "Refund from a friend",
        source: "manual",
      })
      expect(edited.date.toString()).toBe("2026-10-31")
      expect(yield* listTransactions(owner, account.id)).toEqual([edited])
    }),
  )

  it.effect("an invalid edit changes nothing", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const transaction = yield* addManualTransaction(owner, account.id, coffee)

      const error = yield* Effect.flip(
        editManualTransaction(owner, transaction.id, { ...coffee, date: "2026-02-30" }),
      )

      assert(error._tag === "InvalidTransaction")
      expect(yield* listTransactions(owner, account.id)).toEqual([transaction])
    }),
  )

  it.effect("a deleted Transaction is gone from its Account", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)
      const kept = yield* addManualTransaction(owner, account.id, salary)
      const deleted = yield* addManualTransaction(owner, account.id, coffee)

      yield* deleteTransaction(owner, deleted.id)

      expect(yield* listTransactions(owner, account.id)).toEqual([kept])
    }),
  )
})

layer(TestDatabase)("Account balances", (it) => {
  it.effect("a new Account's balance is zero", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* openCurrentAccount(owner)

      expect((yield* getAccount(owner, account.id)).balance).toEqual(Money.eur(0n))
    }),
  )

  it.effect(
    "an Account's balance is the sum of its Transactions, and follows edits and deletes",
    () =>
      Effect.gen(function* () {
        const owner = yield* createOwner
        const account = yield* openCurrentAccount(owner)
        const other = yield* createAccount(owner, {
          name: "Savings",
          role: "reserve",
          currency: "EUR",
        })
        yield* addManualTransaction(owner, account.id, salary)
        const coffeeLine = yield* addManualTransaction(owner, account.id, coffee)
        const rent = yield* addManualTransaction(owner, account.id, {
          date: "2026-10-29",
          amount: "750.5",
          direction: "outflow",
          description: "Renda",
        })
        yield* addManualTransaction(owner, other.id, { ...salary, amount: "100" })

        // 1850.00 − 1.20 − 750.50
        expect((yield* getAccount(owner, account.id)).balance).toEqual(Money.eur(109830n))

        yield* editManualTransaction(owner, coffeeLine.id, { ...coffee, amount: "3" })
        yield* deleteTransaction(owner, rent.id)

        // 1850.00 − 3.00
        expect((yield* getAccount(owner, account.id)).balance).toEqual(Money.eur(184700n))
        expect(
          (yield* listAccounts(owner)).map(({ name, balance }) => ({ name, balance })),
        ).toEqual([
          { name: "Current", balance: Money.eur(184700n) },
          { name: "Savings", balance: Money.eur(10000n) },
        ])
      }),
  )
})

layer(TestDatabase)("Owner scoping of Transactions", (it) => {
  it.effect("an Owner can't add a Transaction to another Owner's Account", () =>
    Effect.gen(function* () {
      const alice = yield* createOwner
      const bob = yield* createOwner
      const alicesAccount = yield* openCurrentAccount(alice)

      const error = yield* Effect.flip(addManualTransaction(bob, alicesAccount.id, coffee))

      expect(error._tag).toBe("AccountNotFound")
      expect(yield* listTransactions(alice, alicesAccount.id)).toEqual([])
    }),
  )

  it.effect("an Owner never sees, edits or deletes another Owner's Transactions", () =>
    Effect.gen(function* () {
      const alice = yield* createOwner
      const bob = yield* createOwner
      const alicesAccount = yield* openCurrentAccount(alice)
      const alicesCoffee = yield* addManualTransaction(alice, alicesAccount.id, coffee)

      expect(yield* listTransactions(bob, alicesAccount.id)).toEqual([])
      expect((yield* Effect.flip(getAccount(bob, alicesAccount.id)))._tag).toBe("AccountNotFound")
      expect((yield* Effect.flip(editManualTransaction(bob, alicesCoffee.id, salary)))._tag).toBe(
        "TransactionNotFound",
      )
      expect((yield* Effect.flip(deleteTransaction(bob, alicesCoffee.id)))._tag).toBe(
        "TransactionNotFound",
      )
      expect(yield* listTransactions(alice, alicesAccount.id)).toEqual([alicesCoffee])
      expect((yield* getAccount(alice, alicesAccount.id)).balance).toEqual(Money.eur(-120n))
    }),
  )
})
