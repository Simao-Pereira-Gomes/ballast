import { Array } from "effect"
import { describe, expect, it } from "vitest"
import { Money } from "../src/index.ts"

describe("Money", () => {
  it("adds amounts in the same currency", () => {
    expect(Money.add(Money.eur(1050n), Money.eur(249n))).toEqual(Money.eur(1299n))
  })

  it("subtracts amounts and can go negative", () => {
    expect(Money.subtract(Money.eur(500n), Money.eur(1250n))).toEqual(Money.eur(-750n))
  })

  it("orders amounts from smallest to largest", () => {
    const amounts = [Money.eur(300n), Money.eur(-5000n), Money.eur(20n), Money.eur(300n)]
    expect(Array.sort(amounts, Money.Order)).toEqual([
      Money.eur(-5000n),
      Money.eur(20n),
      Money.eur(300n),
      Money.eur(300n),
    ])
  })

  describe("allocate", () => {
    it("splits €10.00 three ways, giving the leftover cent to the first part", () => {
      expect(Money.allocate(Money.eur(1000n), [1, 1, 1])).toEqual([
        Money.eur(334n),
        Money.eur(333n),
        Money.eur(333n),
      ])
    })

    it("gives the leftover cent to the part with the largest remainder", () => {
      // €1.00 split 1:2 is €0.333… and €0.666…; the second part rounds up.
      expect(Money.allocate(Money.eur(100n), [1, 2])).toEqual([Money.eur(33n), Money.eur(67n)])
    })

    it("splits negative amounts the same way", () => {
      expect(Money.allocate(Money.eur(-1000n), [1, 1, 1])).toEqual([
        Money.eur(-334n),
        Money.eur(-333n),
        Money.eur(-333n),
      ])
    })
  })

  describe("format", () => {
    // Portuguese convention: comma decimals, no-break space (U+00A0) before "€"
    // and between thousands, and no grouping below 10 000.
    const nbsp = "\u00a0"

    it("formats small amounts with comma decimals", () => {
      expect(Money.format(Money.eur(5n))).toBe(`0,05${nbsp}€`)
    })

    it("does not group four-digit amounts", () => {
      expect(Money.format(Money.eur(123456n))).toBe(`1234,56${nbsp}€`)
    })

    it("groups thousands from five digits and keeps the sign", () => {
      expect(Money.format(Money.eur(-1234567n))).toBe(`-12${nbsp}345,67${nbsp}€`)
    })

    it("formats amounts beyond floating-point precision exactly", () => {
      expect(Money.format(Money.eur(900719925474099123n))).toBe(
        `9${nbsp}007${nbsp}199${nbsp}254${nbsp}740${nbsp}991,23${nbsp}€`,
      )
    })
  })
})
