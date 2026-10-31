import { layer } from "@effect/vitest"
import { Effect } from "effect"
import { assert, expect } from "vitest"
import { createAccount, listAccounts } from "../../src/server/accounts.ts"
import { createOwner } from "../../src/server/owners.ts"
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
      })
      expect(yield* listAccounts(owner)).toEqual([account])
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
        { field: "name", message: "Name is required" },
        { field: "role", message: "Choose an Account Role" },
        { field: "currency", message: "Only EUR is supported" },
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

      expect(yield* listAccounts(alice)).toEqual([alicesAccount])
      expect(yield* listAccounts(bob)).toEqual([bobsAccount])
    }),
  )
})
