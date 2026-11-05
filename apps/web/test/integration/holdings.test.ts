import { Money } from "@ballast/core"
import type { OwnerId } from "@ballast/core"
import { layer } from "@effect/vitest"
import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { assert, expect } from "vitest"
import {
  archiveAccount,
  changeAccount,
  createAccount,
  getAccount,
} from "../../src/server/accounts.ts"
import {
  addHolding,
  changeHolding,
  investmentOverview,
  listHoldings,
  removeHolding,
} from "../../src/server/holdings.ts"
import { createOwner } from "../../src/server/owners.ts"
import { TestDatabase } from "./database.ts"

const brokerage = (owner: OwnerId, name = "Brokerage") =>
  createAccount(owner, { name, role: "investment", currency: "EUR" })

const world = {
  kind: "index_fund",
  name: "iShares Core MSCI World",
  ticker: "IWDA",
  index: "MSCI World",
  assetClass: "equity",
  units: "10,12345678",
  value: "800",
  valuedOn: "2026-11-01",
}

const bonds = {
  kind: "other",
  name: "Euro government bonds",
  assetClass: "bonds",
  value: "200",
  valuedOn: "2026-10-15",
}

const stock = (name: string, ticker: string, value: string) => ({
  kind: "stock",
  name,
  ticker,
  value,
  valuedOn: "2026-11-01",
})

layer(TestDatabase)("Holdings", (it) => {
  it.effect("records Holdings, exact to 8 decimal units, and values the Account by them", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* brokerage(owner)
      const fund = yield* addHolding(owner, account.id, world)
      yield* addHolding(owner, account.id, bonds)

      expect(fund).toMatchObject({
        ownerId: owner,
        accountId: account.id,
        kind: "index_fund",
        index: "MSCI World",
        units: { scaled: 1_012_345_678n },
        value: Money.eur(80_000n),
      })
      expect((yield* listHoldings(owner, account.id)).map((holding) => holding.name)).toEqual([
        "iShares Core MSCI World",
        "Euro government bonds",
      ])
      expect((yield* getAccount(owner, account.id)).valuation).toEqual({
        value: Money.eur(100_000n),
        oldestValuedOn: Temporal.PlainDate.from("2026-10-15"),
      })
    }),
  )

  it.effect("rejects invalid details with every problem named, and records nothing", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* brokerage(owner)
      const error = yield* Effect.flip(
        addHolding(owner, account.id, { kind: "index_fund", name: "Fund", valuedOn: "x" }),
      )

      assert(error._tag === "InvalidHolding")
      expect(error.problems).toEqual([
        { field: "index", problem: "required" },
        { field: "assetClass", problem: "required" },
        { field: "value", problem: "required" },
        { field: "valuedOn", problem: "invalid" },
      ])
      expect(yield* listHoldings(owner, account.id)).toEqual([])
    }),
  )

  it.effect("keeps an unnamed index fund, listed by its Index", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* brokerage(owner)
      const fund = yield* addHolding(owner, account.id, { ...world, name: "" })
      expect(fund.name).toBeNull()
      expect(yield* listHoldings(owner, account.id)).toEqual([fund])
    }),
  )

  it.effect("changes and removes a Holding", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* brokerage(owner)
      const fund = yield* addHolding(owner, account.id, world)

      const changed = yield* changeHolding(owner, fund.id, {
        ...world,
        units: "",
        value: "950,50",
        valuedOn: "2026-11-05",
      })
      expect(changed).toEqual({
        ...fund,
        units: null,
        value: Money.eur(95_050n),
        valuedOn: Temporal.PlainDate.from("2026-11-05"),
      })

      yield* removeHolding(owner, fund.id)
      expect(yield* listHoldings(owner, account.id)).toEqual([])
      expect((yield* getAccount(owner, account.id)).valuation).toBeNull()
      const gone = yield* Effect.flip(removeHolding(owner, fund.id))
      expect(gone._tag).toBe("HoldingNotFound")
    }),
  )

  it.effect("an Owner can't add to, change or remove another Owner's Holdings", () =>
    Effect.gen(function* () {
      const alice = yield* createOwner
      const bob = yield* createOwner
      const alicesAccount = yield* brokerage(alice)
      const fund = yield* addHolding(alice, alicesAccount.id, world)

      expect((yield* Effect.flip(addHolding(bob, alicesAccount.id, world)))._tag).toBe(
        "AccountNotFound",
      )
      expect((yield* Effect.flip(changeHolding(bob, fund.id, world)))._tag).toBe("HoldingNotFound")
      expect((yield* Effect.flip(removeHolding(bob, fund.id)))._tag).toBe("HoldingNotFound")
      expect(yield* listHoldings(alice, alicesAccount.id)).toEqual([fund])
    }),
  )

  it.effect("keeps an Account with Holdings an Investment until they are removed", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const account = yield* brokerage(owner)
      const fund = yield* addHolding(owner, account.id, world)

      const error = yield* Effect.flip(
        changeAccount(owner, account.id, { name: "Brokerage", role: "reserve" }),
      )
      assert(error._tag === "InvalidAccount")
      expect(error.problems).toEqual([{ field: "role", problem: "has_holdings" }])
      expect((yield* getAccount(owner, account.id)).role).toBe("investment")

      yield* changeAccount(owner, account.id, { name: "Renamed", role: "investment" })
      yield* removeHolding(owner, fund.id)
      const reserve = yield* changeAccount(owner, account.id, { name: "Renamed", role: "reserve" })
      expect(reserve.role).toBe("reserve")
    }),
  )

  it.effect("the database refuses Holdings outside an Investment Account", () =>
    Effect.gen(function* () {
      const owner = yield* createOwner
      const savings = yield* createAccount(owner, {
        name: "Savings",
        role: "reserve",
        currency: "EUR",
      })
      const sql = yield* SqlClient
      const refused = yield* Effect.flip(
        sql`
          INSERT INTO holding (owner_id, account_id, kind, name, asset_class, value_cents,
                               valued_on)
          VALUES (${owner}, ${savings.id}, 'other', 'Gold', 'other', 100, '2026-11-01')
        `,
      )
      expect(refused._tag).toBe("SqlError")
    }),
  )

  it.effect(
    "the overview adds up active Investment by Asset Class, Index and stock, and flags concentration",
    () =>
      Effect.gen(function* () {
        const owner = yield* createOwner
        const first = yield* brokerage(owner, "Brokerage")
        const second = yield* brokerage(owner, "PPR")
        const closed = yield* brokerage(owner, "Old broker")
        yield* addHolding(owner, first.id, { ...world, value: "900" })
        yield* addHolding(owner, second.id, {
          ...world,
          name: "Xtrackers",
          index: "msci world",
          value: "700",
        })
        yield* addHolding(owner, first.id, stock("Apple", "AAPL", "300"))
        yield* addHolding(owner, second.id, stock("Galp", "GALP", "100"))
        yield* addHolding(owner, closed.id, stock("Ignored", "IGN", "9999"))
        yield* archiveAccount(owner, closed.id)

        const { accounts, overall, concentrated } = yield* investmentOverview(owner)

        expect(accounts.map((account) => account.name)).toEqual(["Brokerage", "PPR"])
        expect(overall.total).toEqual(Money.eur(200_000n))
        expect(overall.byAssetClass).toEqual([
          { assetClass: "equity", value: Money.eur(200_000n), share: { basisPoints: 10_000 } },
        ])
        expect(overall.byIndex).toEqual([
          { index: "MSCI World", value: Money.eur(160_000n), share: { basisPoints: 8000 } },
        ])
        expect(overall.byStock.map((slice) => [slice.name, slice.share.basisPoints])).toEqual([
          ["Apple", 1500],
          ["Galp", 500],
        ])
        expect(concentrated.map((slice) => slice.name)).toEqual(["Apple"])
        // The archived Account keeps its Holdings.
        expect(yield* listHoldings(owner, closed.id)).toHaveLength(1)
      }),
  )
})
