import type { Transaction } from "@ballast/core"
import { Effect } from "effect"
import { accountsOfCurrentOwner } from "./accounts.ts"
import { listMatchSuggestionsForCurrentOwner } from "./matches.ts"

/** One thing waiting for the Owner. Slice 2 adds more kinds (uncategorised Transactions, Transfer pairs). */
export type ReviewItem = {
  readonly kind: "match"
  readonly accountId: string
  readonly manual: Transaction
  readonly imported: Transaction
  readonly daysApart: number
}

/** How many items wait in the Review Queue, for the navigation badge. */
export const reviewCountOfCurrentOwner = Effect.map(
  listMatchSuggestionsForCurrentOwner,
  (suggestions) => suggestions.length,
)

/** The current Owner's Review Queue: everything awaiting confirmation, with the Account names to group it by. */
export const reviewQueueOfCurrentOwner = Effect.gen(function* () {
  const suggestions = yield* listMatchSuggestionsForCurrentOwner
  const { active } = yield* accountsOfCurrentOwner
  const items = suggestions.map((s): ReviewItem => ({
    kind: "match",
    accountId: s.manual.accountId,
    manual: s.manual,
    imported: s.imported,
    daysApart: s.daysApart,
  }))
  return { items, accounts: active.map(({ id, name }) => ({ id, name })) }
})
