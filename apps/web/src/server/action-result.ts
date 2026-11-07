import {
  HoldingNotFound,
  InvalidAccount,
  InvalidHolding,
  InvalidImport,
  InvalidTransaction,
  TransactionNotFound,
} from "@ballast/core"
import { Effect } from "effect"

type Fixable = InvalidAccount | InvalidTransaction | InvalidHolding | InvalidImport

const isFixable = (error: unknown): error is Fixable =>
  error instanceof InvalidAccount ||
  error instanceof InvalidTransaction ||
  error instanceof InvalidHolding ||
  error instanceof InvalidImport

/** What an action acted on and that may since have gone, e.g. deleted in another tab. */
type Gone = TransactionNotFound | HoldingNotFound

const isGone = (error: unknown): error is Gone =>
  error instanceof TransactionNotFound || error instanceof HoldingNotFound

type ProblemsOf<E> = E extends Fixable ? E["problems"][number] : never

/**
 * What an action tells the browser: it worked, the Owner must fix what they
 * submitted, or (only for actions that can fail this way) the Transaction
 * or Holding it acted on no longer exists, e.g. it was deleted in another tab.
 */
export type ActionResult<A, E> =
  | { readonly ok: true; readonly value: A }
  | ([ProblemsOf<E>] extends [never]
      ? never
      : {
          readonly ok: false
          readonly reason: "invalid"
          readonly problems: readonly ProblemsOf<E>[]
        })
  | ([Extract<E, Gone>] extends [never] ? never : { readonly ok: false; readonly reason: "gone" })

/** Turns the failures the Owner can act on into results; any other failure stays a failure. */
export const toActionResult = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<ActionResult<A, E>, Exclude<E, Fixable | Gone>, R> =>
  effect.pipe(
    Effect.map((value): ActionResult<A, E> => ({ ok: true, value })),
    Effect.catch((error: E) => {
      if (isFixable(error)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `error` is the part of E that is Fixable, so its problems are ProblemsOf<E>
        const problems = error.problems as readonly ProblemsOf<E>[]
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- E includes a Fixable error here, so the "invalid" result is part of ActionResult<A, E>
        return Effect.succeed({ ok: false, reason: "invalid", problems } as ActionResult<A, E>)
      }
      if (isGone(error)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- E includes a Gone error here, so the "gone" result is part of ActionResult<A, E>
        return Effect.succeed({ ok: false, reason: "gone" } as ActionResult<A, E>)
      }
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every other error is outside Fixable and Gone
      return Effect.fail(error as Exclude<E, Fixable | Gone>)
    }),
  )
