import { describe, expect, it } from "vitest"
import { Units } from "../src/index.ts"

describe("Units.parse", () => {
  it("reads whole and fractional quantities after a point or a comma", () => {
    expect(Units.parse("12")).toEqual({ scaled: 1_200_000_000n })
    expect(Units.parse(" 0,5 ")).toEqual({ scaled: 50_000_000n })
    expect(Units.parse("0.00012345")).toEqual({ scaled: 12_345n })
  })

  it("rejects signs, grouping, more than 8 decimals and anything else", () => {
    for (const text of ["-1", "1 000", "1.000,5", "0.123456789", "abc", "", "1e3"]) {
      expect(Units.parse(text)).toBeUndefined()
    }
  })
})

describe("Units decimals", () => {
  it("round-trip through the exact decimal Postgres stores", () => {
    const units = { scaled: 150_000_000n }
    expect(Units.toDecimal(units)).toBe("1.50000000")
    expect(Units.fromDecimal("1.50000000")).toEqual(units)
    expect(Units.toDecimal({ scaled: 1n })).toBe("0.00000001")
  })
})

describe("Units formatting", () => {
  it("shows the quantity in the interface language", () => {
    expect(Units.format({ scaled: 123_450_000_000n }, "pt-PT")).toBe("1234,5")
    expect(Units.format({ scaled: 123_450_000_000n }, "en")).toBe("1,234.5")
    expect(Units.format({ scaled: 12_345n }, "en")).toBe("0.00012345")
  })

  it("writes what the Owner would type, which parse reads back", () => {
    const units = { scaled: 123_450_000_000n }
    expect(Units.formatForInput(units, "pt-PT")).toBe("1234,5")
    expect(Units.formatForInput({ scaled: 300_000_000n }, "en")).toBe("3")
    expect(Units.parse(Units.formatForInput(units, "pt-PT"))).toEqual(units)
  })
})
