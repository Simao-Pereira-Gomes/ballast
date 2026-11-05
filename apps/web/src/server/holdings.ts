import {
  AccountId,
  AssetClass,
  HoldingId,
  HoldingKind,
  HoldingNotFound,
  OwnerId,
  Units,
  breakdown,
  concentratedStocks,
  decodeHoldingDetails,
} from "@ballast/core"
import type { AccountSummary, Holding, HoldingDetails } from "@ballast/core"
import { Effect, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { getAccount, listAccounts } from "./accounts.ts"
import { CurrentOwner } from "./owners.ts"

const HoldingRow = Schema.Struct({
  id: HoldingId,
  ownerId: OwnerId,
  accountId: AccountId,
  kind: HoldingKind,
  name: Schema.NullOr(Schema.String),
  ticker: Schema.NullOr(Schema.String),
  index: Schema.NullOr(Schema.String),
  assetClass: AssetClass,
  units: Schema.NullOr(Schema.String),
  valueCents: Schema.BigIntFromString,
  valuedOn: Schema.String,
})

const decodeRows = (rows: unknown) =>
  Schema.decodeUnknownEffect(Schema.Array(HoldingRow))(rows).pipe(
    Effect.orDie,
    Effect.map((decoded) =>
      decoded.map(({ units, valueCents, valuedOn, ...row }): Holding => ({
        ...row,
        units: units === null ? null : Units.fromDecimal(units),
        value: { cents: valueCents, currency: "EUR" },
        valuedOn: Temporal.PlainDate.from(valuedOn),
      })),
    ),
  )

/** Postgres would hand back `numeric`, `bigint` and `date` lossily, so they're read as text. */
const columns = `id, owner_id AS "ownerId", account_id AS "accountId", kind, name, ticker,
  index_name AS index, asset_class AS "assetClass", units::text AS units,
  value_cents::text AS "valueCents", valued_on::text AS "valuedOn"`

/** The details as column values. */
const valuesOf = (details: HoldingDetails) => ({
  units: details.units === null ? null : Units.toDecimal(details.units),
  valueCents: details.value.cents.toString(),
  valuedOn: details.valuedOn.toString(),
})

const asHoldingId = (holdingId: string) =>
  Effect.fromOption(Schema.decodeUnknownOption(HoldingId)(holdingId)).pipe(
    Effect.mapError(() => new HoldingNotFound({ holdingId })),
  )

/** The one Holding a write affected, or `HoldingNotFound`. */
const affected = (holdingId: string, rows: readonly Holding[]) => {
  const [holding] = rows
  return holding === undefined
    ? Effect.fail(new HoldingNotFound({ holdingId }))
    : Effect.succeed(holding)
}

/** Largest first, then by name, so lists read the same way as breakdowns. */
const order = `ORDER BY value_cents DESC, COALESCE(name, index_name), id`

/**
 * Records a Holding in one of the Owner's Investment Accounts. Fails with
 * `InvalidHolding` when the details break a rule, and with `AccountNotFound`
 * when the Account isn't the Owner's. Only Investments take Holdings; the
 * interface never offers it elsewhere, so another Role is a bug.
 */
export const addHolding = (ownerId: OwnerId, accountId: string, input: unknown) =>
  Effect.gen(function* () {
    const details = yield* Effect.fromResult(decodeHoldingDetails(input))
    const account = yield* getAccount(ownerId, accountId)
    if (account.role !== "investment") {
      return yield* Effect.die(`addHolding: Account ${account.id} is not an Investment`)
    }
    const values = valuesOf(details)
    const sql = yield* SqlClient
    const rows = yield* decodeRows(
      yield* sql`
        INSERT INTO holding (owner_id, account_id, kind, name, ticker, index_name, asset_class,
                             units, value_cents, valued_on)
        VALUES (${ownerId}, ${account.id}, ${details.kind}, ${details.name}, ${details.ticker},
                ${details.index}, ${details.assetClass}, ${values.units}, ${values.valueCents},
                ${values.valuedOn})
        RETURNING ${sql.literal(columns)}
      `,
    )
    const [holding] = rows
    if (holding === undefined) return yield* Effect.die("INSERT … RETURNING gave no row")
    return holding
  })

/** Replaces everything about one of the Owner's Holdings, e.g. a new value. */
export const changeHolding = (ownerId: OwnerId, holdingId: string, input: unknown) =>
  Effect.gen(function* () {
    const details = yield* Effect.fromResult(decodeHoldingDetails(input))
    const id = yield* asHoldingId(holdingId)
    const values = valuesOf(details)
    const sql = yield* SqlClient
    const rows = yield* decodeRows(
      yield* sql`
        UPDATE holding
        SET kind = ${details.kind},
            name = ${details.name},
            ticker = ${details.ticker},
            index_name = ${details.index},
            asset_class = ${details.assetClass},
            units = ${values.units},
            value_cents = ${values.valueCents},
            valued_on = ${values.valuedOn},
            updated_at = now()
        WHERE owner_id = ${ownerId} AND id = ${id}
        RETURNING ${sql.literal(columns)}
      `,
    )
    return yield* affected(holdingId, rows)
  })

/** Removes one of the Owner's Holdings. */
export const removeHolding = (ownerId: OwnerId, holdingId: string) =>
  Effect.gen(function* () {
    const id = yield* asHoldingId(holdingId)
    const sql = yield* SqlClient
    const rows = yield* decodeRows(
      yield* sql`
        DELETE FROM holding WHERE owner_id = ${ownerId} AND id = ${id}
        RETURNING ${sql.literal(columns)}
      `,
    )
    yield* affected(holdingId, rows)
  })

/** The Holdings in one of the Owner's Accounts, largest first. */
export const listHoldings = (ownerId: OwnerId, accountId: AccountId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const holdings: readonly Holding[] = yield* decodeRows(
      yield* sql`
        SELECT ${sql.literal(columns)} FROM holding
        WHERE owner_id = ${ownerId} AND account_id = ${accountId}
        ${sql.literal(order)}
      `,
    )
    return holdings
  })

/**
 * All of the Owner's Investment, across active Investment Accounts: the
 * breakdown by Asset Class, Index and stock, the stocks above the
 * Concentration Limit, and each Account's Valuation. Archived Accounts are
 * left out, though they keep their Holdings.
 */
export const investmentOverview = (ownerId: OwnerId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const holdings = yield* decodeRows(
      yield* sql`
        SELECT ${sql.literal(columns)} FROM holding h
        WHERE h.owner_id = ${ownerId} AND EXISTS (
          SELECT 1 FROM account a
          WHERE a.owner_id = h.owner_id AND a.id = h.account_id AND a.archived_at IS NULL
        )
        ${sql.literal(order)}
      `,
    )
    const accounts: readonly AccountSummary[] = (yield* listAccounts(ownerId)).filter(
      (account) => account.role === "investment",
    )
    const overall = breakdown(holdings)
    return { accounts, overall, concentrated: concentratedStocks(overall) }
  })

export const investmentOverviewOfCurrentOwner = Effect.gen(function* () {
  const owner = yield* CurrentOwner
  return yield* investmentOverview(owner.id)
})

export const addHoldingForCurrentOwner = (accountId: string, input: unknown) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* addHolding(owner.id, accountId, input)
  })

export const changeHoldingForCurrentOwner = (holdingId: string, input: unknown) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* changeHolding(owner.id, holdingId, input)
  })

export const removeHoldingForCurrentOwner = (holdingId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    yield* removeHolding(owner.id, holdingId)
  })
