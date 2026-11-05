import {
  AccountId,
  AccountNotFound,
  AccountRole,
  Money,
  OwnerId,
  decodeNewAccount,
} from "@ballast/core"
import type { Account, AccountSummary } from "@ballast/core"
import { Effect, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { CurrentOwner } from "./owners.ts"

const AccountRow = Schema.Struct({
  id: AccountId,
  ownerId: OwnerId,
  name: Schema.String,
  role: AccountRole,
  currency: Money.Currency,
})

const AccountSummaryRow = Schema.Struct({
  ...AccountRow.fields,
  balanceCents: Schema.BigIntFromString,
})

const decodeOne = (rows: unknown) =>
  Schema.decodeUnknownEffect(Schema.Tuple([AccountRow]))(rows).pipe(Effect.orDie)
const decodeSummaries = (rows: unknown) =>
  Schema.decodeUnknownEffect(Schema.Array(AccountSummaryRow))(rows).pipe(Effect.orDie)

const toSummary = ({
  balanceCents,
  ...account
}: typeof AccountSummaryRow.Type): AccountSummary => ({
  ...account,
  balance: { cents: balanceCents, currency: account.currency },
})

/**
 * Opens an Account for the Owner. Fails with `InvalidAccount` when the
 * submitted details break a rule.
 */
export const createAccount = (ownerId: OwnerId, input: unknown) =>
  Effect.gen(function* () {
    const details = yield* Effect.fromResult(decodeNewAccount(input))
    const sql = yield* SqlClient
    const [account] = yield* decodeOne(
      yield* sql`
        INSERT INTO account (owner_id, name, role, currency)
        VALUES (${ownerId}, ${details.name}, ${details.role}, ${details.currency})
        RETURNING id, owner_id AS "ownerId", name, role, currency
      `,
    )
    return account satisfies Account
  })

/** The Owner's Accounts with their balances, matching `accountId` when given. */
const selectSummaries = (ownerId: OwnerId, accountId?: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    return yield* decodeSummaries(
      yield* sql`
        SELECT a.id, a.owner_id AS "ownerId", a.name, a.role, a.currency,
               COALESCE(SUM(t.amount_cents), 0)::text AS "balanceCents"
        FROM account a
        LEFT JOIN transaction t ON t.owner_id = a.owner_id AND t.account_id = a.id
        WHERE a.owner_id = ${ownerId}
          ${accountId === undefined ? sql`` : sql`AND a.id = ${accountId}`}
        GROUP BY a.owner_id, a.id
        ORDER BY a.created_at, a.id
      `,
    )
  })

/** The Owner's Accounts with their balances, oldest first. */
export const listAccounts = (ownerId: OwnerId) =>
  Effect.map(selectSummaries(ownerId), (rows): readonly AccountSummary[] => rows.map(toSummary))

/**
 * One of the Owner's Accounts with its balance. Fails with `AccountNotFound`
 * when the Owner has no such Account.
 */
export const getAccount = (ownerId: OwnerId, accountId: string) =>
  Effect.gen(function* () {
    const decoded = Schema.decodeUnknownOption(AccountId)(accountId)
    const [row] = decoded._tag === "Some" ? yield* selectSummaries(ownerId, decoded.value) : []
    if (row === undefined) return yield* new AccountNotFound({ accountId })
    return toSummary(row)
  })

/** Opens an Account for the Owner of the current request. */
export const openAccountForCurrentOwner = (input: unknown) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* createAccount(owner.id, input)
  })

/** The current request's Owner's Accounts. */
export const accountsOfCurrentOwner = Effect.gen(function* () {
  const owner = yield* CurrentOwner
  return yield* listAccounts(owner.id)
})

/** One of the current request's Owner's Accounts. */
export const accountOfCurrentOwner = (accountId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* getAccount(owner.id, accountId)
  })
