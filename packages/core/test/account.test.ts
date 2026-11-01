import { Result } from "effect"
import { describe, expect, it } from "vitest"
import { decodeNewAccount } from "../src/index.ts"

const problemsOf = (input: unknown) => {
  const result = decodeNewAccount(input)
  return Result.isFailure(result) ? result.failure.problems : []
}

describe("decodeNewAccount", () => {
  it("accepts valid details, trimming the name", () => {
    const result = decodeNewAccount({
      name: "  Santander Current ",
      role: "reserve",
      currency: "EUR",
    })
    expect(Result.getOrThrow(result)).toEqual({
      name: "Santander Current",
      role: "reserve",
      currency: "EUR",
    })
  })

  it("names every problem as a code, never a sentence", () => {
    expect(problemsOf({ name: "   ", role: "savings", currency: "USD" })).toEqual([
      { field: "name", problem: "required" },
      { field: "role", problem: "required" },
      { field: "currency", problem: "unsupported" },
    ])
  })

  it("reports a name that is too long", () => {
    expect(problemsOf({ name: "x".repeat(101), role: "reserve", currency: "EUR" })).toEqual([
      { field: "name", problem: "too_long" },
    ])
  })

  it("treats missing fields as required", () => {
    expect(problemsOf({ currency: "EUR" })).toEqual([
      { field: "name", problem: "required" },
      { field: "role", problem: "required" },
    ])
  })
})
