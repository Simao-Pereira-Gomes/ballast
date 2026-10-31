import { InvalidAccount } from "@ballast/core"
import type { AccountProblem } from "@ballast/core"
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

export type ActionResult<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly problems: readonly AccountProblem[] }

/** Errors the Owner can fix by changing what they submitted. */
type Fixable = InvalidAccount

const isFixable = (error: unknown): error is Fixable => error instanceof InvalidAccount

export const runQuery = <A, E>(effect: Effect.Effect<A, E, AppServices>): Promise<A> =>
  runtime.runPromise(effect)

export const runAction = <A, E>(
  effect: Effect.Effect<A, E, AppServices>,
): Promise<ActionResult<A>> =>
  runtime.runPromise(
    effect.pipe(
      Effect.map((value): ActionResult<A> => ({ ok: true, value })),
      Effect.catchIf(
        (error: E): error is E & Fixable => isFixable(error),
        (error) => Effect.succeed<ActionResult<A>>({ ok: false, problems: error.problems }),
      ),
    ),
  )
