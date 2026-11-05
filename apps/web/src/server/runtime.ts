import { Effect, Layer, ManagedRuntime, Schedule } from "effect"
import type { SqlClient } from "effect/sql/SqlClient"
import { toActionResult } from "./action-result.ts"
import type { ActionResult } from "./action-result.ts"
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

export type { ActionResult } from "./action-result.ts"

export const runQuery = <A, E>(effect: Effect.Effect<A, E, AppServices>): Promise<A> =>
  runtime.runPromise(effect)

export const runAction = <A, E>(
  effect: Effect.Effect<A, E, AppServices>,
): Promise<ActionResult<A, E>> => runtime.runPromise(toActionResult(effect))
