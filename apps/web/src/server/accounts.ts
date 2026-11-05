import {
  AccountId,
  AccountNotFound,
  AccountRole,
  InvalidAccount,
  Money,
  OwnerId,
  decodeAccountChanges,
  decodeNewAccount,
} from "@ballast/core"
import type { Account, AccountSummary, AccountTerms } from "@ballast/core"
import { Effect, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { CurrentOwner } from "./owners.ts"

const AccountRow = Schema.Struct({
  id: AccountId,
  ownerId: OwnerId,
  name: Schema.String,
  role: AccountRole,
  currency: Money.Currency,
  interestRateBp: Schema.NullOr(Schema.Number),
  archived: Schema.Boolean,
})

const AccountSummaryRow = Schema.Struct({
  ...AccountRow.fields,
  balanceCents: Schema.BigIntFromString,
  valuationCents: Schema.NullOr(Schema.BigIntFromString),
  oldestValuedOn: Schema.NullOr(Schema.String),
})

const toAccount = ({ interestRateBp, ...row }: typeof AccountRow.Type): Account => ({
  ...row,
  interestRate: interestRateBp === null ? null : { basisPoints: interestRateBp },
})

const toSummary = ({
  balanceCents,
  valuationCents,
  oldestValuedOn,
  ...row
}: typeof AccountSummaryRow.Type): AccountSummary => {
  const account = toAccount(row)
  return {
    ...account,
    balance: { cents: balanceCents, currency: account.currency },
    valuation:
      valuationCents === null || oldestValuedOn === null
        ? null
        : {
            value: { cents: valuationCents, currency: account.currency },
            oldestValuedOn: Temporal.PlainDate.from(oldestValuedOn),
          },
  }
}

const decodeAccounts = (rows: unknown) =>
  Schema.decodeUnknownEffect(Schema.Array(AccountRow))(rows).pipe(
    Effect.orDie,
    Effect.map((decoded) => decoded.map(toAccount)),
  )
const decodeSummaries = (rows: unknown) =>
  Schema.decodeUnknownEffect(Schema.Array(AccountSummaryRow))(rows).pipe(
    Effect.orDie,
    Effect.map((decoded): readonly AccountSummary[] => decoded.map(toSummary)),
  )

/** The Account columns, read from the table aliased `table`. */
const accountColumns = (table: string) =>
  `${table}.id, ${table}.owner_id AS "ownerId", ${table}.name, ${table}.role,
  ${table}.currency, ${table}.interest_rate_bp AS "interestRateBp",
  ${table}.archived_at IS NOT NULL AS archived`

const columns = accountColumns("account")

/** The terms as column values: `null` where the Role has none. */
const termColumns = ({ interestRate }: AccountTerms) => ({
  interestRateBp: interestRate?.basisPoints ?? null,
})

const asAccountId = (accountId: string) =>
  Effect.fromOption(Schema.decodeUnknownOption(AccountId)(accountId)).pipe(
    Effect.mapError(() => new AccountNotFound({ accountId })),
  )

/** The one Account a write affected, or `AccountNotFound`. */
const affected = (accountId: string, accounts: readonly Account[]) => {
  const [account] = accounts
  return account === undefined
    ? Effect.fail(new AccountNotFound({ accountId }))
    : Effect.succeed(account)
}

/**
 * Opens an Account for the Owner. Fails with `InvalidAccount` when the
 * submitted details break a rule.
 */
export const createAccount = (ownerId: OwnerId, input: unknown) =>
  Effect.gen(function* () {
    const details = yield* Effect.fromResult(decodeNewAccount(input))
    const terms = termColumns(details)
    const sql = yield* SqlClient
    const accounts = yield* decodeAccounts(
      yield* sql`
        INSERT INTO account (owner_id, name, role, currency, interest_rate_bp)
        VALUES (${ownerId}, ${details.name}, ${details.role}, ${details.currency},
                ${terms.interestRateBp})
        RETURNING ${sql.literal(columns)}
      `,
    )
    const [account] = accounts
    if (account === undefined) return yield* Effect.die("INSERT … RETURNING gave no row")
    return account
  })

/**
 * Changes the name, Role and Role terms of one of the Owner's Accounts,
 * archived or not. Moving away from Liability clears its rate. An Account
 * with Holdings stays an Investment until they are removed (ADR 0007).
 * Fails with `InvalidAccount` or `AccountNotFound`.
 */
export const changeAccount = (ownerId: OwnerId, accountId: string, input: unknown) =>
  Effect.gen(function* () {
    const changes = yield* Effect.fromResult(decodeAccountChanges(input))
    const id = yield* asAccountId(accountId)
    const terms = termColumns(changes)
    const sql = yield* SqlClient
    if (changes.role !== "investment") {
      const [held] = yield* sql`
        SELECT 1 FROM holding WHERE owner_id = ${ownerId} AND account_id = ${id} LIMIT 1
      `
      if (held !== undefined) {
        return yield* new InvalidAccount({
          problems: [{ field: "role", problem: "has_holdings" }],
        })
      }
    }
    const accounts = yield* decodeAccounts(
      yield* sql`
        UPDATE account
        SET name = ${changes.name},
            role = ${changes.role},
            interest_rate_bp = ${terms.interestRateBp}
        WHERE owner_id = ${ownerId} AND id = ${id}
        RETURNING ${sql.literal(columns)}
      `,
    )
    return yield* affected(accountId, accounts)
  })

/**
 * Archives one of the Owner's Accounts: it keeps its Transactions but leaves
 * `listAccounts`, and so every active view and later advice. Archiving an
 * archived Account changes nothing.
 */
export const archiveAccount = (ownerId: OwnerId, accountId: string) =>
  Effect.gen(function* () {
    const id = yield* asAccountId(accountId)
    const sql = yield* SqlClient
    const accounts = yield* decodeAccounts(
      yield* sql`
        UPDATE account SET archived_at = COALESCE(archived_at, now())
        WHERE owner_id = ${ownerId} AND id = ${id}
        RETURNING ${sql.literal(columns)}
      `,
    )
    return yield* affected(accountId, accounts)
  })

/** Brings an archived Account back into the Owner's active Accounts. */
export const unarchiveAccount = (ownerId: OwnerId, accountId: string) =>
  Effect.gen(function* () {
    const id = yield* asAccountId(accountId)
    const sql = yield* SqlClient
    const accounts = yield* decodeAccounts(
      yield* sql`
        UPDATE account SET archived_at = NULL
        WHERE owner_id = ${ownerId} AND id = ${id}
        RETURNING ${sql.literal(columns)}
      `,
    )
    return yield* affected(accountId, accounts)
  })

/** The Owner's Accounts with their balances and Valuations, narrowed by `where`. */
const selectSummaries = (
  ownerId: OwnerId,
  where: { readonly accountId: AccountId } | { readonly archived: boolean },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const narrowing =
      "accountId" in where
        ? sql`AND a.id = ${where.accountId}`
        : where.archived
          ? sql`AND a.archived_at IS NOT NULL`
          : sql`AND a.archived_at IS NULL`
    return yield* decodeSummaries(
      yield* sql`
        SELECT ${sql.literal(accountColumns("a"))},
               COALESCE(t.balance_cents, 0)::text AS "balanceCents",
               h.valuation_cents::text AS "valuationCents",
               h.oldest_valued_on::text AS "oldestValuedOn"
        FROM account a
        LEFT JOIN (
          SELECT owner_id, account_id, SUM(amount_cents) AS balance_cents
          FROM transaction WHERE owner_id = ${ownerId} GROUP BY owner_id, account_id
        ) t ON t.owner_id = a.owner_id AND t.account_id = a.id
        LEFT JOIN (
          SELECT owner_id, account_id, SUM(value_cents) AS valuation_cents,
                 MIN(valued_on) AS oldest_valued_on
          FROM holding WHERE owner_id = ${ownerId} GROUP BY owner_id, account_id
        ) h ON h.owner_id = a.owner_id AND h.account_id = a.id
        WHERE a.owner_id = ${ownerId} ${narrowing}
        ORDER BY a.created_at, a.id
      `,
    )
  })

/**
 * The Owner's active Accounts with their balances, oldest first. Archived
 * Accounts are left out, so anything built on this list ignores them.
 */
export const listAccounts = (ownerId: OwnerId) => selectSummaries(ownerId, { archived: false })

/** The Owner's archived Accounts with their balances, oldest first. */
export const listArchivedAccounts = (ownerId: OwnerId) =>
  selectSummaries(ownerId, { archived: true })

/**
 * One of the Owner's Accounts, archived or not, with its balance. Fails with
 * `AccountNotFound` when the Owner has no such Account.
 */
export const getAccount = (ownerId: OwnerId, accountId: string) =>
  Effect.gen(function* () {
    const id = yield* asAccountId(accountId)
    const [account] = yield* selectSummaries(ownerId, { accountId: id })
    if (account === undefined) return yield* new AccountNotFound({ accountId })
    return account
  })

/** Opens an Account for the Owner of the current request. */
export const openAccountForCurrentOwner = (input: unknown) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* createAccount(owner.id, input)
  })

/** The current request's Owner's active and archived Accounts. */
export const accountsOfCurrentOwner = Effect.gen(function* () {
  const owner = yield* CurrentOwner
  const active = yield* listAccounts(owner.id)
  const archived = yield* listArchivedAccounts(owner.id)
  return { active, archived }
})

/** One of the current request's Owner's Accounts. */
export const accountOfCurrentOwner = (accountId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* getAccount(owner.id, accountId)
  })

export const changeAccountForCurrentOwner = (accountId: string, input: unknown) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* changeAccount(owner.id, accountId, input)
  })

export const archiveAccountForCurrentOwner = (accountId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    yield* archiveAccount(owner.id, accountId)
  })

export const unarchiveAccountForCurrentOwner = (accountId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    yield* unarchiveAccount(owner.id, accountId)
  })
