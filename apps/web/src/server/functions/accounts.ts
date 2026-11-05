import { createServerFn } from "@tanstack/react-start"
import { Schema } from "effect"
import {
  accountsOfCurrentOwner,
  archiveAccountForCurrentOwner,
  changeAccountForCurrentOwner,
  openAccountForCurrentOwner,
  unarchiveAccountForCurrentOwner,
} from "../accounts.ts"
import { runAction, runQuery } from "../runtime.ts"

export type { AccountProblem } from "@ballast/core"

/** The Role terms a form submits; the Accounts service checks them against the Role. */
const TermsForm = {
  interestRate: Schema.optionalKey(Schema.String),
}

/** The shape a form submits; the Accounts service checks the rules. */
const AccountForm = Schema.Struct({
  name: Schema.String,
  role: Schema.String,
  currency: Schema.String,
  ...TermsForm,
})

const AccountChangesForm = Schema.Struct({
  accountId: Schema.String,
  name: Schema.String,
  role: Schema.String,
  ...TermsForm,
})

const AccountRef = Schema.Struct({ accountId: Schema.String })

export const getAccounts = createServerFn({ method: "GET" }).handler(() =>
  runQuery(accountsOfCurrentOwner),
)

export const openAccount = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AccountForm))
  .handler(({ data }) => runAction(openAccountForCurrentOwner(data)))

export const changeAccount = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AccountChangesForm))
  .handler(({ data: { accountId, ...changes } }) =>
    runAction(changeAccountForCurrentOwner(accountId, changes)),
  )

export const archiveAccount = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AccountRef))
  .handler(({ data }) => runQuery(archiveAccountForCurrentOwner(data.accountId)))

export const unarchiveAccount = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AccountRef))
  .handler(({ data }) => runQuery(unarchiveAccountForCurrentOwner(data.accountId)))
