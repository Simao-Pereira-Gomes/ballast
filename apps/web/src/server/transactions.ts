import {
  AccountId,
  OwnerId,
  TransactionId,
  TransactionNotFound,
  TransactionSource,
  decodeTransactionDetails,
} from "@ballast/core"
import type { Transaction } from "@ballast/core"
import { Effect, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { getAccount } from "./accounts.ts"
import { CurrentOwner } from "./owners.ts"

const TransactionRow = Schema.Struct({
  id: TransactionId,
  ownerId: OwnerId,
  accountId: AccountId,
  date: Schema.String,
  amountCents: Schema.BigIntFromString,
  description: Schema.String,
  source: TransactionSource,
})

const decodeRows = (rows: unknown) =>
  Schema.decodeUnknownEffect(Schema.Array(TransactionRow))(rows).pipe(
    Effect.orDie,
    Effect.map((decoded) =>
      decoded.map(({ date, amountCents, ...row }): Transaction => ({
        ...row,
        date: Temporal.PlainDate.from(date),
        amount: { cents: amountCents, currency: "EUR" },
      })),
    ),
  )

/** Postgres would hand back a `date` as a JS Date, so it's read as ISO text. */
const columns = `id, owner_id AS "ownerId", account_id AS "accountId", date::text AS date,
  amount_cents::text AS "amountCents", description, source`

const asTransactionId = (transactionId: string) =>
  Effect.fromOption(Schema.decodeUnknownOption(TransactionId)(transactionId)).pipe(
    Effect.mapError(() => new TransactionNotFound({ transactionId })),
  )

/** The one Transaction a write affected, or `TransactionNotFound`. */
const affected = (transactionId: string, rows: readonly Transaction[]) => {
  const [transaction] = rows
  return transaction === undefined
    ? Effect.fail(new TransactionNotFound({ transactionId }))
    : Effect.succeed(transaction)
}

/**
 * Records a Transaction the Owner entered by hand on one of their Accounts.
 * Fails with `InvalidTransaction` when the details break a rule, and with
 * `AccountNotFound` when the Account isn't the Owner's.
 */
export const addManualTransaction = (ownerId: OwnerId, accountId: string, input: unknown) =>
  Effect.gen(function* () {
    const details = yield* Effect.fromResult(decodeTransactionDetails(input))
    const account = yield* getAccount(ownerId, accountId)
    const sql = yield* SqlClient
    const rows = yield* decodeRows(
      yield* sql`
        INSERT INTO transaction (owner_id, account_id, date, amount_cents, description, source)
        VALUES (${ownerId}, ${account.id}, ${details.date.toString()},
                ${details.amount.cents.toString()}, ${details.description}, 'manual')
        RETURNING ${sql.literal(columns)}
      `,
    )
    const [transaction] = rows
    if (transaction === undefined) return yield* Effect.die("INSERT … RETURNING gave no row")
    return transaction
  })

/**
 * Replaces the date, amount, direction and description of one of the
 * Owner's manual Transactions. Imported Transactions can't be edited this way.
 */
export const editManualTransaction = (ownerId: OwnerId, transactionId: string, input: unknown) =>
  Effect.gen(function* () {
    const details = yield* Effect.fromResult(decodeTransactionDetails(input))
    const id = yield* asTransactionId(transactionId)
    const sql = yield* SqlClient
    const rows = yield* decodeRows(
      yield* sql`
        UPDATE transaction
        SET date = ${details.date.toString()},
            amount_cents = ${details.amount.cents.toString()},
            description = ${details.description},
            updated_at = now()
        WHERE owner_id = ${ownerId} AND id = ${id} AND source = 'manual'
        RETURNING ${sql.literal(columns)}
      `,
    )
    return yield* affected(transactionId, rows)
  })

/** Deletes one of the Owner's manual Transactions. Imported ones stay. */
export const deleteManualTransaction = (ownerId: OwnerId, transactionId: string) =>
  Effect.gen(function* () {
    const id = yield* asTransactionId(transactionId)
    const sql = yield* SqlClient
    const rows = yield* decodeRows(
      yield* sql`
        DELETE FROM transaction
        WHERE owner_id = ${ownerId} AND id = ${id} AND source = 'manual'
        RETURNING ${sql.literal(columns)}
      `,
    )
    yield* affected(transactionId, rows)
  })

/** The Transactions on one of the Owner's Accounts, newest first. */
export const listTransactions = (ownerId: OwnerId, accountId: string) =>
  Effect.gen(function* () {
    const decoded = Schema.decodeUnknownOption(AccountId)(accountId)
    if (decoded._tag === "None") return []
    const sql = yield* SqlClient
    const transactions: readonly Transaction[] = yield* decodeRows(
      yield* sql`
        SELECT ${sql.literal(columns)}
        FROM transaction
        WHERE owner_id = ${ownerId} AND account_id = ${decoded.value}
        ORDER BY date DESC, created_at DESC, id
      `,
    )
    return transactions
  })

/** One of the current Owner's Accounts, with its balance and Transactions. */
export const accountLedgerOfCurrentOwner = (accountId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    const account = yield* getAccount(owner.id, accountId)
    const transactions = yield* listTransactions(owner.id, account.id)
    return { account, transactions }
  })

export const addManualTransactionForCurrentOwner = (accountId: string, input: unknown) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* addManualTransaction(owner.id, accountId, input)
  })

export const editManualTransactionForCurrentOwner = (transactionId: string, input: unknown) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    return yield* editManualTransaction(owner.id, transactionId, input)
  })

export const deleteManualTransactionForCurrentOwner = (transactionId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    yield* deleteManualTransaction(owner.id, transactionId)
  })
