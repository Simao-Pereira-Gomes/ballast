import { Result } from "effect"
import { assert, describe, expect, it } from "vitest"
import { Money, decodeTransactionDetails } from "../src/index.ts"

const valid = {
  date: "2026-10-31",
  amount: "12.34",
  direction: "outflow",
  description: "Café Central",
}

const problemsOf = (input: unknown) => {
  const result = decodeTransactionDetails(input)
  assert(Result.isFailure(result))
  return result.failure.problems
}

describe("decodeTransactionDetails", () => {
  it("turns an outflow into a negative amount on its calendar date", () => {
    const result = decodeTransactionDetails(valid)
    assert(Result.isSuccess(result))
    expect(result.success.amount).toEqual(Money.eur(-1234n))
    expect(result.success.date.equals(Temporal.PlainDate.from("2026-10-31"))).toBe(true)
    expect(result.success.description).toBe("Café Central")
  })

  it("keeps an inflow positive", () => {
    const result = decodeTransactionDetails({ ...valid, direction: "inflow", amount: "1850" })
    assert(Result.isSuccess(result))
    expect(result.success.amount).toEqual(Money.eur(185000n))
  })

  it.each([
    ["12", 1200n],
    ["12.3", 1230n],
    ["12,34", 1234n],
    ["0.05", 5n],
    [" 7,5 ", 750n],
  ])("reads the amount %j as %d cents", (amount, cents) => {
    const result = decodeTransactionDetails({ ...valid, direction: "inflow", amount })
    assert(Result.isSuccess(result))
    expect(result.success.amount).toEqual(Money.eur(cents))
  })

  it("trims the description", () => {
    const result = decodeTransactionDetails({ ...valid, description: "  Mercado  " })
    assert(Result.isSuccess(result))
    expect(result.success.description).toBe("Mercado")
  })

  it("names every missing detail", () => {
    expect(problemsOf({})).toEqual([
      { field: "date", problem: "required" },
      { field: "amount", problem: "required" },
      { field: "direction", problem: "required" },
      { field: "description", problem: "required" },
    ])
  })

  it.each(["31/10/2026", "2026-02-30", "2026-13-01", "yesterday"])(
    "rejects the date %j",
    (date) => {
      expect(problemsOf({ ...valid, date })).toEqual([{ field: "date", problem: "invalid" }])
    },
  )

  it.each(["-12", "12.345", "1.234,56", "1 234", "12€", "abc", ".5"])(
    "rejects the amount %j",
    (amount) => {
      expect(problemsOf({ ...valid, amount })).toEqual([{ field: "amount", problem: "invalid" }])
    },
  )

  it("rejects a zero amount", () => {
    expect(problemsOf({ ...valid, amount: "0,00" })).toEqual([{ field: "amount", problem: "zero" }])
  })

  it("rejects an unknown direction", () => {
    expect(problemsOf({ ...valid, direction: "sideways" })).toEqual([
      { field: "direction", problem: "required" },
    ])
  })

  it("rejects a description over 200 characters", () => {
    expect(problemsOf({ ...valid, description: "x".repeat(201) })).toEqual([
      { field: "description", problem: "too_long" },
    ])
    assert(Result.isSuccess(decodeTransactionDetails({ ...valid, description: "x".repeat(200) })))
  })
})
