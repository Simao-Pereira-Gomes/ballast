import { createServerFn } from "@tanstack/react-start"
import { Schema } from "effect"
import { runAction, runQuery } from "../runtime.ts"
import {
  accountLedgerOfCurrentOwner,
  addManualTransactionForCurrentOwner,
  deleteManualTransactionForCurrentOwner,
  editManualTransactionForCurrentOwner,
} from "../transactions.ts"

export type { TransactionProblem } from "@ballast/core"

/** The shape the Transaction form submits; the Transactions service checks the rules. */
const TransactionForm = Schema.Struct({
  date: Schema.String,
  amount: Schema.String,
  direction: Schema.String,
  description: Schema.String,
})

export const getAccountLedger = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ accountId: Schema.String })))
  .handler(({ data }) => runQuery(accountLedgerOfCurrentOwner(data.accountId)))

export const addTransaction = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ accountId: Schema.String, ...TransactionForm.fields }),
    ),
  )
  .handler(({ data: { accountId, ...details } }) =>
    runAction(addManualTransactionForCurrentOwner(accountId, details)),
  )

export const editTransaction = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ transactionId: Schema.String, ...TransactionForm.fields }),
    ),
  )
  .handler(({ data: { transactionId, ...details } }) =>
    runAction(editManualTransactionForCurrentOwner(transactionId, details)),
  )

export const deleteTransaction = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ transactionId: Schema.String })))
  .handler(({ data }) => runAction(deleteManualTransactionForCurrentOwner(data.transactionId)))
