import { createServerFn } from "@tanstack/react-start"
import { Schema } from "effect"
import { confirmMatchForCurrentOwner, rejectMatchForCurrentOwner } from "../matches.ts"
import { reviewCountOfCurrentOwner, reviewQueueOfCurrentOwner } from "../review.ts"
import { runAction, runQuery } from "../runtime.ts"

export type { ReviewItem } from "../review.ts"

const Pair = Schema.toStandardSchemaV1(
  Schema.Struct({ manualId: Schema.String, importedId: Schema.String }),
)

export const getReviewCount = createServerFn({ method: "GET" }).handler(() =>
  runQuery(reviewCountOfCurrentOwner),
)

export const getReviewQueue = createServerFn({ method: "GET" }).handler(() =>
  runQuery(reviewQueueOfCurrentOwner),
)

export const confirmMatch = createServerFn({ method: "POST" })
  .validator(Pair)
  .handler(({ data }) => runAction(confirmMatchForCurrentOwner(data.manualId, data.importedId)))

export const rejectMatch = createServerFn({ method: "POST" })
  .validator(Pair)
  .handler(({ data }) => runAction(rejectMatchForCurrentOwner(data.manualId, data.importedId)))
