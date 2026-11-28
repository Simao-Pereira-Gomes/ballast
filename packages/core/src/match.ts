import { Data } from "effect"
import * as Money from "./money.ts"
import type { Transaction, TransactionId } from "./transaction.ts"

/** How many days apart a manual and an imported Transaction can be and still be suggested as a Match. */
export const matchWindowDays = 3

/** A manual and an imported Transaction, identified by their ids. */
export interface MatchPair {
  readonly manualId: TransactionId
  readonly importedId: TransactionId
}

/** A suggested Match: a manual and an imported Transaction that may be the same movement. */
export interface MatchSuggestion extends MatchPair {
  readonly daysApart: number
}

const compareDates = (a: Temporal.PlainDate, b: Temporal.PlainDate): number =>
  Temporal.PlainDate.compare(a, b)

/**
 * Suggests Matches among an Owner's Transactions: a manual and an imported
 * Transaction on the same Account, with the same signed amount and dates at
 * most `matchWindowDays` apart, leaving out pairs the Owner has rejected.
 *
 * When a Transaction has several candidates, every pair is suggested, closest
 * dates first, then the older manual entry, then the older imported one.
 */
export const suggestMatches = (
  transactions: readonly Transaction[],
  rejected: readonly MatchPair[],
): MatchSuggestion[] => {
  const isRejected = (manualId: TransactionId, importedId: TransactionId) =>
    rejected.some((pair) => pair.manualId === manualId && pair.importedId === importedId)
  const manual = transactions.filter((t) => t.source === "manual")
  const imported = transactions.filter((t) => t.source === "import")

  const candidates = manual.flatMap((m) =>
    imported.flatMap((i) => {
      if (m.accountId !== i.accountId || !Money.equals(m.amount, i.amount)) return []
      if (isRejected(m.id, i.id)) return []
      const daysApart = Math.abs(m.date.until(i.date, { largestUnit: "days" }).days)
      return daysApart <= matchWindowDays ? [{ m, i, daysApart }] : []
    }),
  )

  return candidates
    .toSorted(
      (a, b) =>
        a.daysApart - b.daysApart ||
        compareDates(a.m.date, b.m.date) ||
        compareDates(a.i.date, b.i.date) ||
        a.m.id.localeCompare(b.m.id) ||
        a.i.id.localeCompare(b.i.id),
    )
    .map(({ m, i, daysApart }) => ({ manualId: m.id, importedId: i.id, daysApart }))
}

/** What a manual Transaction held before a Match merged it away, kept so undoing the Import can restore it. */
export interface MatchSnapshot {
  readonly date: Temporal.PlainDate
  readonly amount: Money.Money
  readonly description: string
  readonly notes: string | null
}

/**
 * Merges a confirmed Match: the imported Transaction survives with the bank's
 * date, amount and description, and the Owner's manual description joins its
 * notes. The manual Transaction's own details are returned as a snapshot.
 */
export const mergeMatch = (
  manual: Transaction,
  imported: Transaction,
): { readonly merged: Transaction; readonly snapshot: MatchSnapshot } => ({
  merged: {
    ...imported,
    notes: [imported.notes, manual.notes, manual.description]
      .filter((part) => part !== null)
      .join("\n"),
  },
  snapshot: {
    date: manual.date,
    amount: manual.amount,
    description: manual.description,
    notes: manual.notes,
  },
})

/** The pair isn't a Match currently suggested to this Owner: unknown, already decided, or not theirs. */
export class MatchNotFound extends Data.TaggedError("MatchNotFound")<{
  readonly manualId: string
  readonly importedId: string
}> {}
