import { describe, expect, it } from "vitest"
import { InterestRate } from "../src/index.ts"

describe("InterestRate.parse", () => {
  it.each([
    ["18", 1800],
    ["18.5", 1850],
    ["18,25", 1825],
    [" 7,9 % ", 790],
    ["0", 0],
    ["100", 10_000],
  ])("reads %j as %i basis points", (text, basisPoints) => {
    expect(InterestRate.parse(text)).toEqual({ basisPoints })
  })

  it.each(["", "abc", "-3", "1.234", "100.01", "250", "1 000", "1e2"])("rejects %j", (text) => {
    expect(InterestRate.parse(text)).toBeUndefined()
  })
})

describe("InterestRate.format", () => {
  it("shows the rate as a percentage in the interface language", () => {
    expect(InterestRate.format({ basisPoints: 1850 }, "en")).toBe("18.5%")
    expect(InterestRate.format({ basisPoints: 1850 }, "pt-PT")).toBe("18,5%")
    expect(InterestRate.format({ basisPoints: 1825 }, "pt-PT")).toBe("18,25%")
    expect(InterestRate.format({ basisPoints: 0 }, "en")).toBe("0%")
  })
})

describe("InterestRate.formatForInput", () => {
  it("writes the rate the way the Owner would type it, which parse reads back", () => {
    expect(InterestRate.formatForInput({ basisPoints: 1850 }, "pt-PT")).toBe("18,5")
    expect(InterestRate.formatForInput({ basisPoints: 1825 }, "en")).toBe("18.25")
    expect(InterestRate.formatForInput({ basisPoints: 1800 }, "en")).toBe("18")
    expect(InterestRate.parse(InterestRate.formatForInput({ basisPoints: 5 }, "pt-PT"))).toEqual({
      basisPoints: 5,
    })
  })
})
