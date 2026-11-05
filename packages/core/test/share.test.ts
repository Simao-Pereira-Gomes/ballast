import { describe, expect, it } from "vitest"
import { Share } from "../src/index.ts"

describe("Share.of", () => {
  it("is the part's share of the total in basis points, rounded half up", () => {
    expect(Share.of(1n, 4n)).toEqual({ basisPoints: 2500 })
    expect(Share.of(1n, 3n)).toEqual({ basisPoints: 3333 })
    expect(Share.of(2n, 3n)).toEqual({ basisPoints: 6667 })
    expect(Share.of(1n, 20_000n)).toEqual({ basisPoints: 1 })
    expect(Share.of(7n, 7n)).toEqual({ basisPoints: 10_000 })
  })

  it("is zero of nothing", () => {
    expect(Share.of(0n, 0n)).toEqual({ basisPoints: 0 })
  })
})

describe("Share.exceeds", () => {
  it("compares exactly, so exactly at the limit isn't above it", () => {
    const tenPercent = { basisPoints: 1000 }
    expect(Share.exceeds(100n, 1000n, tenPercent)).toBe(false)
    expect(Share.exceeds(101n, 1000n, tenPercent)).toBe(true)
    // 10.0004% rounds to 10% but is still above the limit.
    expect(Share.exceeds(100_004n, 1_000_000n, tenPercent)).toBe(true)
    expect(Share.exceeds(0n, 0n, tenPercent)).toBe(false)
  })
})

describe("Share.format", () => {
  it("shows one decimal in the interface language", () => {
    expect(Share.format({ basisPoints: 2550 }, "pt-PT")).toBe("25,5%")
    expect(Share.format({ basisPoints: 2550 }, "en")).toBe("25.5%")
    expect(Share.format({ basisPoints: 10_000 }, "en")).toBe("100%")
  })
})
