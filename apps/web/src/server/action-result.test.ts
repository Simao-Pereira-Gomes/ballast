import {
  HoldingNotFound,
  InvalidHolding,
  InvalidTransaction,
  TransactionNotFound,
} from "@ballast/core"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { toActionResult } from "./action-result.ts"

describe("toActionResult", () => {
  it.effect("passes a success through", () =>
    Effect.gen(function* () {
      expect(yield* toActionResult(Effect.succeed(42))).toEqual({ ok: true, value: 42 })
    }),
  )

  it.effect("turns details the Owner can fix into their problems", () =>
    Effect.gen(function* () {
      const problems = [{ field: "amount", problem: "zero" }] as const
      const result = yield* toActionResult(Effect.fail(new InvalidTransaction({ problems })))

      expect(result).toEqual({ ok: false, reason: "invalid", problems })
    }),
  )

  it.effect("reports a Transaction that no longer exists as gone", () =>
    Effect.gen(function* () {
      const result = yield* toActionResult(
        Effect.fail(new TransactionNotFound({ transactionId: "a-stale-id" })),
      )

      expect(result).toEqual({ ok: false, reason: "gone" })
    }),
  )

  it.effect("treats a Holding the same way: fixable details, or gone", () =>
    Effect.gen(function* () {
      const problems = [{ field: "value", problem: "required" }] as const
      expect(yield* toActionResult(Effect.fail(new InvalidHolding({ problems })))).toEqual({
        ok: false,
        reason: "invalid",
        problems,
      })
      expect(
        yield* toActionResult(Effect.fail(new HoldingNotFound({ holdingId: "a-stale-id" }))),
      ).toEqual({ ok: false, reason: "gone" })
    }),
  )

  it.effect("lets any other failure through", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(toActionResult(Effect.fail(new Error("database down"))))

      expect(error).toEqual(new Error("database down"))
    }),
  )
})
