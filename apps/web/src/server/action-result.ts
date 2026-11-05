import { InvalidAccount, InvalidTransaction, TransactionNotFound } from "@ballast/core"
import { Effect } from "effect"

type Fixable = InvalidAccount | InvalidTransaction

const isFixable = (error: unknown): error is Fixable =>
  error instanceof InvalidAccount || error instanceof InvalidTransaction

type ProblemsOf<E> = E extends Fixable ? E["problems"][number] : never

/**
 * What an action tells the browser: it worked, the Owner must fix what they
 * submitted, or (only for actions that can fail this way) the Transaction
 * it acted on no longer exists, e.g. it was deleted in another tab.
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
  | (TransactionNotFound extends E ? { readonly ok: false; readonly reason: "gone" } : never)

/** Turns the failures the Owner can act on into results; any other failure stays a failure. */
export const toActionResult = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<ActionResult<A, E>, Exclude<E, Fixable | TransactionNotFound>, R> =>
  effect.pipe(
    Effect.map((value): ActionResult<A, E> => ({ ok: true, value })),
    Effect.catch((error: E) => {
      if (isFixable(error)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `error` is the part of E that is Fixable, so its problems are ProblemsOf<E>
        const problems = error.problems as readonly ProblemsOf<E>[]
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- E includes a Fixable error here, so the "invalid" result is part of ActionResult<A, E>
        return Effect.succeed({ ok: false, reason: "invalid", problems } as ActionResult<A, E>)
      }
      if (error instanceof TransactionNotFound) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- E includes TransactionNotFound here, so the "gone" result is part of ActionResult<A, E>
        return Effect.succeed({ ok: false, reason: "gone" } as ActionResult<A, E>)
      }
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every other error is outside Fixable and TransactionNotFound
      return Effect.fail(error as Exclude<E, Fixable | TransactionNotFound>)
    }),
  )
