import {
  AccountId,
  AccountNotFound,
  AccountRole,
  Money,
  OwnerId,
  decodeAccountChanges,
  decodeNewAccount,
} from "@ballast/core"
import type { Account, AccountSummary, AccountTerms, AssetMix } from "@ballast/core"
import { Effect, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { CurrentOwner } from "./owners.ts"

const Percent = Schema.NullOr(Schema.Number)

const AccountRow = Schema.Struct({
  id: AccountId,
  ownerId: OwnerId,
  name: Schema.String,
  role: AccountRole,
  currency: Money.Currency,
  interestRateBp: Schema.NullOr(Schema.Number),
  equityPercent: Percent,
  bondsPercent: Percent,
  cashPercent: Percent,
  cryptoPercent: Percent,
  otherPercent: Percent,
  archived: Schema.Boolean,
})

const AccountSummaryRow = Schema.Struct({
  ...AccountRow.fields,
  balanceCents: Schema.BigIntFromString,
})

/** The database keeps the mix as all five percentages or none (migration 0003). */
const toAccount = ({
  interestRateBp,
  equityPercent,
  bondsPercent,
  cashPercent,
  cryptoPercent,
  otherPercent,
  ...row
}: typeof AccountRow.Type): Account => ({
  ...row,
  interestRate: interestRateBp === null ? null : { basisPoints: interestRateBp },
  assetMix:
    equityPercent === null ||
    bondsPercent === null ||
    cashPercent === null ||
    cryptoPercent === null ||
    otherPercent === null
      ? null
      : {
          equity: equityPercent,
          bonds: bondsPercent,
          cash: cashPercent,
          crypto: cryptoPercent,
          other: otherPercent,
        },
})

const toSummary = ({ balanceCents, ...row }: typeof AccountSummaryRow.Type): AccountSummary => {
  const account = toAccount(row)
  return { ...account, balance: { cents: balanceCents, currency: account.currency } }
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
  ${table}.equity_percent AS "equityPercent", ${table}.bonds_percent AS "bondsPercent",
  ${table}.cash_percent AS "cashPercent", ${table}.crypto_percent AS "cryptoPercent",
  ${table}.other_percent AS "otherPercent",
  ${table}.archived_at IS NOT NULL AS archived`

const columns = accountColumns("account")

/** The terms as column values: `null` where the Role has none. */
const termColumns = ({ interestRate, assetMix }: AccountTerms) => {
  const percent = (assetClass: keyof AssetMix) => assetMix?.[assetClass] ?? null
  return {
    interestRateBp: interestRate?.basisPoints ?? null,
    equity: percent("equity"),
    bonds: percent("bonds"),
    cash: percent("cash"),
    crypto: percent("crypto"),
    other: percent("other"),
  }
}

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
        INSERT INTO account (owner_id, name, role, currency, interest_rate_bp,
                             equity_percent, bonds_percent, cash_percent, crypto_percent,
                             other_percent)
        VALUES (${ownerId}, ${details.name}, ${details.role}, ${details.currency},
                ${terms.interestRateBp}, ${terms.equity}, ${terms.bonds}, ${terms.cash},
                ${terms.crypto}, ${terms.other})
        RETURNING ${sql.literal(columns)}
      `,
    )
    const [account] = accounts
    if (account === undefined) return yield* Effect.die("INSERT … RETURNING gave no row")
    return account
  })

/**
 * Changes the name, Role and Role terms of one of the Owner's Accounts,
 * archived or not. Moving away from Liability or Investment clears their
 * terms. Fails with `InvalidAccount` or `AccountNotFound`.
 */
export const changeAccount = (ownerId: OwnerId, accountId: string, input: unknown) =>
  Effect.gen(function* () {
    const changes = yield* Effect.fromResult(decodeAccountChanges(input))
    const id = yield* asAccountId(accountId)
    const terms = termColumns(changes)
    const sql = yield* SqlClient
    const accounts = yield* decodeAccounts(
      yield* sql`
        UPDATE account
        SET name = ${changes.name},
            role = ${changes.role},
            interest_rate_bp = ${terms.interestRateBp},
            equity_percent = ${terms.equity},
            bonds_percent = ${terms.bonds},
            cash_percent = ${terms.cash},
            crypto_percent = ${terms.crypto},
            other_percent = ${terms.other}
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

/** The Owner's Accounts with their balances, narrowed by `where`. */
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
               COALESCE(SUM(t.amount_cents), 0)::text AS "balanceCents"
        FROM account a
        LEFT JOIN transaction t ON t.owner_id = a.owner_id AND t.account_id = a.id
        WHERE a.owner_id = ${ownerId} ${narrowing}
        GROUP BY a.owner_id, a.id
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
