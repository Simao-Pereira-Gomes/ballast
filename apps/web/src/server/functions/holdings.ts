import { createServerFn } from "@tanstack/react-start"
import { Schema } from "effect"
import {
  addHoldingForCurrentOwner,
  changeHoldingForCurrentOwner,
  investmentOverviewOfCurrentOwner,
  removeHoldingForCurrentOwner,
} from "../holdings.ts"
import { runAction, runQuery } from "../runtime.ts"

export type { HoldingProblem } from "@ballast/core"

/** The shape the Holding form submits; the Holdings service checks the rules. */
const HoldingForm = {
  kind: Schema.String,
  name: Schema.String,
  ticker: Schema.String,
  index: Schema.String,
  assetClass: Schema.String,
  units: Schema.String,
  value: Schema.String,
  valuedOn: Schema.String,
}

export const getInvestmentOverview = createServerFn({ method: "GET" }).handler(() =>
  runQuery(investmentOverviewOfCurrentOwner),
)

export const addHolding = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ accountId: Schema.String, ...HoldingForm })))
  .handler(({ data: { accountId, ...details } }) =>
    runAction(addHoldingForCurrentOwner(accountId, details)),
  )

export const changeHolding = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ holdingId: Schema.String, ...HoldingForm })))
  .handler(({ data: { holdingId, ...details } }) =>
    runAction(changeHoldingForCurrentOwner(holdingId, details)),
  )

export const removeHolding = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ holdingId: Schema.String })))
  .handler(({ data }) => runAction(removeHoldingForCurrentOwner(data.holdingId)))
