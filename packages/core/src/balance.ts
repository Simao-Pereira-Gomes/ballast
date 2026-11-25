/**
 * Balance Checkpoints and Balance Discrepancies (ADR 0002). An Import states
 * the bank's balance after its newest line, on that line's date: a Balance
 * Checkpoint. The Owner never has to enter an opening balance. The earliest
 * Checkpoint is the Account's anchor: the bank's own figure, trusted as the
 * Account's balance at the end of that day. From there the Account's balance
 * is the anchor plus every Transaction dated after it, and each later
 * Checkpoint is checked against the same sum. Comparison is by day, so a
 * Checkpoint is read as the balance at the end of its date.
 */
import * as Money from "./money.ts"

/** The balance the bank stated for an Account at the end of a date. */
export interface BalanceCheckpoint {
  readonly date: Temporal.PlainDate
  readonly balance: Money.Money
}

/** A Checkpoint the Account's Transactions don't add up to. */
export interface BalanceDiscrepancy {
  readonly date: Temporal.PlainDate
  /** What the bank stated. */
  readonly stated: Money.Money
  /** What the Transactions add up to on that date. */
  readonly computed: Money.Money
  /** Stated minus computed: positive when money seems to be missing, negative when there is too much. */
  readonly difference: Money.Money
}

type Dated = { readonly date: Temporal.PlainDate; readonly amount: Money.Money }

const byDate = (a: BalanceCheckpoint, b: BalanceCheckpoint) =>
  Temporal.PlainDate.compare(a.date, b.date)

const sumAfter = (transactions: readonly Dated[], after: Temporal.PlainDate | undefined) =>
  transactions
    .filter(({ date }) => after === undefined || Temporal.PlainDate.compare(date, after) > 0)
    .reduce((total, { amount }) => Money.add(total, amount), Money.eur(0n))

/**
 * The Account's balance: the sum of its Transactions, unless it has a
 * Checkpoint, in which case the earliest Checkpoint's stated balance plus the
 * Transactions dated after it, so a missing opening balance never skews it.
 */
export const accountBalance = (
  checkpoints: readonly BalanceCheckpoint[],
  transactions: readonly Dated[],
): Money.Money => {
  const [anchor] = checkpoints.toSorted(byDate)
  return Money.add(anchor?.balance ?? Money.eur(0n), sumAfter(transactions, anchor?.date))
}

/**
 * Every Checkpoint after the anchor that the Transactions don't add up to,
 * oldest first. Adding a missing Transaction or removing a duplicate clears
 * the Discrepancy; there is none until the Account has two Checkpoints.
 */
export const findDiscrepancies = (
  checkpoints: readonly BalanceCheckpoint[],
  transactions: readonly Dated[],
): readonly BalanceDiscrepancy[] => {
  const [anchor, ...later] = checkpoints.toSorted(byDate)
  if (anchor === undefined) return []
  return later.flatMap((checkpoint) => {
    const between = transactions.filter(
      ({ date }) =>
        Temporal.PlainDate.compare(date, anchor.date) > 0 &&
        Temporal.PlainDate.compare(date, checkpoint.date) <= 0,
    )
    const computed = between.reduce((total, { amount }) => Money.add(total, amount), anchor.balance)
    const difference = Money.subtract(checkpoint.balance, computed)
    return difference.cents === 0n
      ? []
      : [{ date: checkpoint.date, stated: checkpoint.balance, computed, difference }]
  })
}
