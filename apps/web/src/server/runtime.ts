import { InvalidAccount, InvalidTransaction } from "@ballast/core"
import { Effect, Layer, ManagedRuntime, Schedule } from "effect"
import type { SqlClient } from "effect/sql/SqlClient"
import { DatabaseLive } from "./database.ts"
import { migrate } from "./migrate.ts"
import { CurrentOwner, ensureDefaultOwner } from "./owners.ts"

const MigratedDatabase = Layer.effectDiscard(
  migrate.pipe(Effect.retry({ schedule: Schedule.spaced("1 second"), times: 30 })),
).pipe(Layer.provideMerge(DatabaseLive))

const DefaultOwner = Layer.effect(
  CurrentOwner,
  ensureDefaultOwner.pipe(Effect.map((id) => ({ id }))),
)

const AppLayer = DefaultOwner.pipe(Layer.provideMerge(MigratedDatabase))

export type AppServices = SqlClient | CurrentOwner

const runtime = ManagedRuntime.make(AppLayer)

export const prepare = (): Promise<unknown> => runtime.context()

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => void runtime.dispose())
}

/** Errors the Owner can fix by changing what they submitted. */
type Fixable = InvalidAccount | InvalidTransaction

const isFixable = (error: unknown): error is Fixable =>
  error instanceof InvalidAccount || error instanceof InvalidTransaction

/** The problems an action's fixable errors can name. */
type ProblemsOf<E> = E extends Fixable ? E["problems"][number] : never

export type ActionResult<A, P> =
  { readonly ok: true; readonly value: A } | { readonly ok: false; readonly problems: readonly P[] }

export const runQuery = <A, E>(effect: Effect.Effect<A, E, AppServices>): Promise<A> =>
  runtime.runPromise(effect)

export const runAction = <A, E>(
  effect: Effect.Effect<A, E, AppServices>,
): Promise<ActionResult<A, ProblemsOf<E>>> =>
  runtime.runPromise(
    effect.pipe(
      Effect.map((value): ActionResult<A, ProblemsOf<E>> => ({ ok: true, value })),
      Effect.catchIf(
        (error: E): error is E & Fixable => isFixable(error),
        (error) =>
          Effect.succeed<ActionResult<A, ProblemsOf<E>>>({
            ok: false,
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `error` is the part of E that is Fixable, so its problems are ProblemsOf<E>
            problems: error.problems as readonly ProblemsOf<E>[],
          }),
      ),
    ),
  )
