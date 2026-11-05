import { Result } from "effect"
import { describe, expect, it } from "vitest"
import {
  Money,
  breakdown,
  concentratedStocks,
  decodeHoldingDetails,
  holdingName,
} from "../src/index.ts"
import type { HoldingDetails } from "../src/index.ts"

const problemsOf = (input: unknown) => {
  const result = decodeHoldingDetails(input)
  return Result.isFailure(result) ? result.failure.problems : []
}

const indexFund = {
  kind: "index_fund",
  name: "Vanguard FTSE All-World",
  ticker: "vwce",
  index: " FTSE  All-World ",
  assetClass: "equity",
  units: "12,5",
  value: "1500,40",
  valuedOn: "2026-11-01",
}

describe("decodeHoldingDetails", () => {
  it("accepts an index fund, tidying its name, ticker and Index", () => {
    expect(Result.getOrThrow(decodeHoldingDetails(indexFund))).toEqual({
      kind: "index_fund",
      name: "Vanguard FTSE All-World",
      ticker: "VWCE",
      index: "FTSE All-World",
      assetClass: "equity",
      units: { scaled: 1_250_000_000n },
      value: Money.eur(150_040n),
      valuedOn: Temporal.PlainDate.from("2026-11-01"),
    })
  })

  it("makes a stock equity, whatever class was submitted, and keeps no Index", () => {
    const stock = decodeHoldingDetails({
      kind: "stock",
      name: "Galp",
      assetClass: "bonds",
      index: "PSI",
      value: "200",
      valuedOn: "2026-11-01",
    })
    expect(Result.getOrThrow(stock)).toMatchObject({
      assetClass: "equity",
      index: null,
      ticker: null,
      units: null,
    })
  })

  it("lets other Holdings be any Asset Class, such as crypto", () => {
    const coin = decodeHoldingDetails({
      kind: "other",
      name: "Bitcoin",
      ticker: "BTC-EUR",
      assetClass: "crypto",
      units: "0.00012345",
      value: "8,10",
      valuedOn: "2026-11-01",
    })
    expect(Result.getOrThrow(coin)).toMatchObject({
      assetClass: "crypto",
      units: { scaled: 12_345n },
    })
  })

  it("lets an index fund go unnamed, calling it by its Index", () => {
    const unnamed = Result.getOrThrow(decodeHoldingDetails({ ...indexFund, name: "  " }))
    expect(unnamed.name).toBeNull()
    expect(holdingName(unnamed)).toBe("FTSE All-World")
    expect(problemsOf({ ...indexFund, kind: "other", name: "" })).toEqual([
      { field: "name", problem: "required" },
    ])
  })

  it("accepts a Holding worth nothing", () => {
    expect(problemsOf({ ...indexFund, value: "0" })).toEqual([])
  })

  it("names every problem as a code", () => {
    expect(
      problemsOf({
        kind: "index_fund",
        name: " ",
        ticker: "not a ticker",
        index: "",
        assetClass: "gold",
        units: "1,2,3",
        value: "-5",
        valuedOn: "2026-02-30",
      }),
    ).toEqual([
      { field: "ticker", problem: "invalid" },
      { field: "index", problem: "required" },
      { field: "assetClass", problem: "required" },
      { field: "units", problem: "invalid" },
      { field: "value", problem: "invalid" },
      { field: "valuedOn", problem: "invalid" },
    ])
  })

  it("treats missing fields as required, but not the optional ones", () => {
    expect(problemsOf({})).toEqual([
      { field: "kind", problem: "required" },
      { field: "name", problem: "required" },
      { field: "value", problem: "required" },
      { field: "valuedOn", problem: "required" },
    ])
  })

  it("rejects zero units and names that are too long", () => {
    expect(
      problemsOf({ ...indexFund, units: "0", name: "x".repeat(101), index: "y".repeat(101) }),
    ).toEqual([
      { field: "name", problem: "too_long" },
      { field: "index", problem: "too_long" },
      { field: "units", problem: "zero" },
    ])
  })
})

const on = (date: string) => Temporal.PlainDate.from(date)
const holding = (details: Partial<HoldingDetails> & Pick<HoldingDetails, "value">) => ({
  kind: "other" as const,
  name: "Something",
  ticker: null,
  index: null,
  assetClass: "other" as const,
  units: null,
  valuedOn: on("2026-11-01"),
  ...details,
})

const world = (cents: bigint, name = "iShares Core MSCI World") =>
  holding({
    kind: "index_fund",
    name,
    index: "MSCI World",
    assetClass: "equity",
    value: Money.eur(cents),
  })
const stock = (name: string, ticker: string | null, cents: bigint) =>
  holding({ kind: "stock", name, ticker, assetClass: "equity", value: Money.eur(cents) })

describe("breakdown", () => {
  it("computes the Asset Mix from values, largest first, leaving out empty classes", () => {
    const result = breakdown([
      world(800_000n),
      holding({ assetClass: "bonds", value: Money.eur(150_000n) }),
      holding({ assetClass: "crypto", value: Money.eur(50_000n) }),
    ])
    expect(result.total).toEqual(Money.eur(1_000_000n))
    expect(result.byAssetClass).toEqual([
      { assetClass: "equity", value: Money.eur(800_000n), share: { basisPoints: 8000 } },
      { assetClass: "bonds", value: Money.eur(150_000n), share: { basisPoints: 1500 } },
      { assetClass: "crypto", value: Money.eur(50_000n), share: { basisPoints: 500 } },
    ])
  })

  it("adds up Holdings tracking the same Index, however it was written", () => {
    const result = breakdown([
      world(300_000n),
      { ...world(100_000n, "Xtrackers MSCI World"), index: "msci  world" },
      holding({
        kind: "index_fund",
        index: "S&P 500",
        assetClass: "equity",
        value: Money.eur(100_000n),
      }),
    ])
    expect(result.byIndex).toEqual([
      { index: "MSCI World", value: Money.eur(400_000n), share: { basisPoints: 8000 } },
      { index: "S&P 500", value: Money.eur(100_000n), share: { basisPoints: 2000 } },
    ])
  })

  it("adds up the same stock held twice, by ticker or else by name", () => {
    const result = breakdown([
      stock("Apple", "AAPL", 10_000n),
      stock("Apple Inc.", "AAPL", 5_000n),
      stock("Galp", null, 3_000n),
      stock("galp", null, 2_000n),
    ])
    expect(result.byStock).toEqual([
      { name: "Apple", ticker: "AAPL", value: Money.eur(15_000n), share: { basisPoints: 7500 } },
      { name: "Galp", ticker: null, value: Money.eur(5_000n), share: { basisPoints: 2500 } },
    ])
  })

  it("says how old the oldest and newest values are", () => {
    const result = breakdown([
      holding({ value: Money.eur(1n), valuedOn: on("2026-10-01") }),
      holding({ value: Money.eur(1n), valuedOn: on("2026-11-03") }),
      holding({ value: Money.eur(1n), valuedOn: on("2026-10-15") }),
    ])
    expect(result.valuedBetween).toEqual({ oldest: on("2026-10-01"), newest: on("2026-11-03") })
  })

  it("is empty without Holdings", () => {
    expect(breakdown([])).toEqual({
      total: Money.eur(0n),
      byAssetClass: [],
      byIndex: [],
      byStock: [],
      valuedBetween: null,
    })
  })
})

describe("concentratedStocks", () => {
  it("flags stocks above 10% of all Investment by default, but not one exactly at it", () => {
    const overall = breakdown([
      world(780_000n),
      stock("Apple", "AAPL", 120_000n),
      stock("Galp", "GALP", 100_000n),
    ])
    expect(concentratedStocks(overall).map((slice) => slice.name)).toEqual(["Apple"])
  })

  it("takes another limit", () => {
    const overall = breakdown([world(950_000n), stock("Galp", "GALP", 50_000n)])
    expect(concentratedStocks(overall, { basisPoints: 400 })).toHaveLength(1)
  })
})
