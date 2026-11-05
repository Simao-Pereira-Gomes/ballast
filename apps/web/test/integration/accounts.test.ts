import { Money } from "@ballast/core"
import { layer } from "@effect/vitest"
import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { assert, expect } from "vitest"
import {
  archiveAccount,
  changeAccount,
  createAccount,
  getAccount,
  listAccounts,
  listArchivedAccounts,
  unarchiveAccount,
} from "../../src/server/accounts.ts"
import { createOwner } from "../../src/server/owners.ts"
import { addManualTransaction } from "../../src/server/transactions.ts"
import { TestDatabase } from "./database.ts"

layer(TestDatabase)("Accounts", (it) => {
  it.effect("a created Account appears in its Owner's list", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* createAccount(owner, {
        name: "Santander Current",
        role: "operating_cash",
        currency: "EUR",
      })

      expect(account).toMatchObject({
        ownerId: owner,
        name: "Santander Current",
        role: "operating_cash",
        currency: "EUR",
        interestRate: null,
        assetMix: null,
        archived: false,
      })
      expect(yield* listAccounts(owner)).toEqual([{ ...account, balance: Money.eur(0n) }])
    }),
  )

  it.effect("rejects invalid details with every problem named, and opens nothing", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const error = yield* Effect.flip(
        createAccount(owner, { name: "   ", role: "savings", currency: "USD" }),
      )

      assert(error._tag === "InvalidAccount")
      expect(error.problems).toEqual([
        { field: "name", problem: "required" },
        { field: "role", problem: "required" },
        { field: "currency", problem: "unsupported" },
      ])
      expect(yield* listAccounts(owner)).toEqual([])
    }),
  )

  it.effect("an Owner never sees another Owner's Accounts", () =>
    Effect.gen(function* () {
      const alice = yield* createOwner
      const bob = yield* createOwner
      const alicesAccount = yield* createAccount(alice, {
        name: "Alice Savings",
        role: "reserve",
        currency: "EUR",
      })
      const bobsAccount = yield* createAccount(bob, {
        name: "Bob Brokerage",
        role: "investment",
        currency: "EUR",
      })

      expect(yield* listAccounts(alice)).toEqual([{ ...alicesAccount, balance: Money.eur(0n) }])
      expect(yield* listAccounts(bob)).toEqual([{ ...bobsAccount, balance: Money.eur(0n) }])
    }),
  )

  it.effect("opens a Liability with its interest rate and an Investment with its mix", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const card = yield* createAccount(owner, {
        name: "Credit card",
        role: "liability",
        currency: "EUR",
        interestRate: "18,5",
      })
      const brokerage = yield* createAccount(owner, {
        name: "Brokerage",
        role: "investment",
        currency: "EUR",
        assetMix: { equity: "80", bonds: "20" },
      })

      expect(card.interestRate).toEqual({ basisPoints: 1850 })
      expect(brokerage.assetMix).toEqual({ equity: 80, bonds: 20, cash: 0, other: 0 })
      expect(yield* listAccounts(owner)).toEqual([
        { ...card, balance: Money.eur(0n) },
        { ...brokerage, balance: Money.eur(0n) },
      ])
    }),
  )

  it.effect("changes an Account's name and Role", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* createAccount(owner, {
        name: "Savings",
        role: "reserve",
        currency: "EUR",
      })

      const changed = yield* changeAccount(owner, account.id, {
        name: "Card",
        role: "liability",
        interestRate: "21",
      })

      expect(changed).toEqual({
        ...account,
        name: "Card",
        role: "liability",
        interestRate: { basisPoints: 2100 },
      })
      expect(yield* getAccount(owner, account.id)).toEqual({ ...changed, balance: Money.eur(0n) })
    }),
  )

  it.effect("drops a Role's terms when the Account moves to another Role", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const loan = yield* createAccount(owner, {
        name: "Loan",
        role: "liability",
        currency: "EUR",
        interestRate: "6",
      })
      const ppr = yield* createAccount(owner, {
        name: "PPR",
        role: "investment",
        currency: "EUR",
        assetMix: { equity: "100" },
      })

      const reserve = yield* changeAccount(owner, loan.id, {
        name: "Loan",
        role: "reserve",
        interestRate: "6",
      })
      const cash = yield* changeAccount(owner, ppr.id, {
        name: "PPR",
        role: "operating_cash",
        assetMix: { equity: "100" },
      })

      expect(reserve.interestRate).toBeNull()
      expect(cash.assetMix).toBeNull()
    }),
  )

  it.effect("rejects an invalid change and keeps the Account as it was", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* createAccount(owner, {
        name: "Brokerage",
        role: "investment",
        currency: "EUR",
      })

      const error = yield* Effect.flip(
        changeAccount(owner, account.id, {
          name: "Brokerage",
          role: "investment",
          assetMix: { equity: "70", bonds: "20" },
        }),
      )

      assert(error._tag === "InvalidAccount")
      expect(error.problems).toEqual([{ field: "assetMix", problem: "not_100", total: 90 }])
      expect(yield* getAccount(owner, account.id)).toEqual({ ...account, balance: Money.eur(0n) })
    }),
  )

  it.effect("an Owner can't change, archive or unarchive another Owner's Account", () =>
    Effect.gen(function* () {
      const alice = yield* createOwner
      const bob = yield* createOwner
      const alicesAccount = yield* createAccount(alice, {
        name: "Alice Savings",
        role: "reserve",
        currency: "EUR",
      })
      const change = { name: "Mine now", role: "reserve" }

      for (const attempt of [
        changeAccount(bob, alicesAccount.id, change),
        archiveAccount(bob, alicesAccount.id),
        unarchiveAccount(bob, alicesAccount.id),
        changeAccount(bob, "not-a-uuid", change),
      ]) {
        const error = yield* Effect.flip(attempt)
        expect(error._tag).toBe("AccountNotFound")
      }
      expect(yield* getAccount(alice, alicesAccount.id)).toEqual({
        ...alicesAccount,
        balance: Money.eur(0n),
      })
    }),
  )

  it.effect("an archived Account keeps its Transactions but leaves the active list", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const open = yield* createAccount(owner, {
        name: "Current",
        role: "operating_cash",
        currency: "EUR",
      })
      const closed = yield* createAccount(owner, {
        name: "Old savings",
        role: "reserve",
        currency: "EUR",
      })
      yield* addManualTransaction(owner, closed.id, {
        date: "2026-10-01",
        amount: "50",
        direction: "inflow",
        description: "Deposit",
      })

      yield* archiveAccount(owner, closed.id)

      const archived = { ...closed, archived: true, balance: Money.eur(5000n) }
      expect(yield* listAccounts(owner)).toEqual([{ ...open, balance: Money.eur(0n) }])
      expect(yield* listArchivedAccounts(owner)).toEqual([archived])
      expect(yield* getAccount(owner, closed.id)).toEqual(archived)
    }),
  )

  it.effect("archiving is idempotent, and unarchiving brings the Account back", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* createAccount(owner, {
        name: "Old savings",
        role: "reserve",
        currency: "EUR",
      })

      yield* archiveAccount(owner, account.id)
      yield* archiveAccount(owner, account.id)
      expect(yield* listArchivedAccounts(owner)).toHaveLength(1)

      yield* unarchiveAccount(owner, account.id)
      expect(yield* listArchivedAccounts(owner)).toEqual([])
      expect(yield* listAccounts(owner)).toEqual([{ ...account, balance: Money.eur(0n) }])
    }),
  )

  it.effect("the database refuses terms on the wrong Role and mixes that don't add up", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* createAccount(owner, {
        name: "Savings",
        role: "reserve",
        currency: "EUR",
      })
      const sql = yield* SqlClient

      for (const update of [
        sql`UPDATE account SET interest_rate_bp = 500 WHERE id = ${account.id}`,
        sql`UPDATE account SET role = 'investment', equity_percent = 60, bonds_percent = 30,
              cash_percent = 0, other_percent = 0 WHERE id = ${account.id}`,
        sql`UPDATE account SET equity_percent = 100, bonds_percent = 0, cash_percent = 0,
              other_percent = 0 WHERE id = ${account.id}`,
        sql`UPDATE account SET role = 'investment', equity_percent = 100 WHERE id = ${account.id}`,
      ]) {
        const error = yield* Effect.flip(update)
        expect(error._tag).toBe("SqlError")
      }
    }),
  )
})
