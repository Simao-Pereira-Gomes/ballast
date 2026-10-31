import { layer } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { createOwner, ensureDefaultOwner } from "../../src/server/owners.ts"
import { TestDatabase } from "./database.ts"

layer(TestDatabase)("Default Owner", (it) => {
  it.effect("is created once and returned on every later start", () =>
    Effect.gen(function* () {
      const first = yield* ensureDefaultOwner
      const second = yield* ensureDefaultOwner

      expect(second).toBe(first)
    }),
  )

  it.effect("stays the same when starts race each other", () =>
    Effect.gen(function* () {
      const owners = yield* Effect.all(
        Array.from({ length: 5 }, () => ensureDefaultOwner),
        { concurrency: "unbounded" },
      )

      expect(new Set(owners).size).toBe(1)
    }),
  )

  it.effect("is not replaced by other Owners", () =>
    Effect.gen(function* () {
      const defaultOwner = yield* ensureDefaultOwner
      const other = yield* createOwner

      expect(other).not.toBe(defaultOwner)
      expect(yield* ensureDefaultOwner).toBe(defaultOwner)
    }),
  )
})
