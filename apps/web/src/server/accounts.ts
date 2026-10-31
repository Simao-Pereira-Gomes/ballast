import { AccountId, AccountRole, Money, OwnerId, decodeNewAccount } from "@ballast/core"
import type { Account } from "@ballast/core"
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

const decodeOne = (rows: unknown) =>
  Schema.decodeUnknownEffect(Schema.Tuple([AccountRow]))(rows).pipe(Effect.orDie)
const decodeMany = (rows: unknown) =>
  Schema.decodeUnknownEffect(Schema.Array(AccountRow))(rows).pipe(Effect.orDie)

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

/** The Owner's Accounts, oldest first. */
export const listAccounts = (ownerId: OwnerId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const accounts: readonly Account[] = yield* decodeMany(
      yield* sql`
        SELECT id, owner_id AS "ownerId", name, role, currency
        FROM account
        WHERE owner_id = ${ownerId}
        ORDER BY created_at, id
      `,
    )
    return accounts
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
