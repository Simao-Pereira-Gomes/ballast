import { createServerFn } from "@tanstack/react-start"
import { Schema } from "effect"
import { accountsOfCurrentOwner, openAccountForCurrentOwner } from "../accounts.ts"
import { runAction, runQuery } from "../runtime.ts"

export type { AccountProblem } from "@ballast/core"

/** The shape a form submits; the Accounts service checks the rules. */
const AccountForm = Schema.Struct({
  name: Schema.String,
  role: Schema.String,
  currency: Schema.String,
})

export const getAccounts = createServerFn({ method: "GET" }).handler(() =>
  runQuery(accountsOfCurrentOwner),
)

export const openAccount = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AccountForm))
  .handler(({ data }) => runAction(openAccountForCurrentOwner(data)))
