import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { Money } from "../src/index.ts"

const amount = fc.bigInt({ min: -10_000_000_00n, max: 10_000_000_00n }).map(Money.eur)
const ratios = fc
  .array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 12 })
  .filter((rs) => rs.some((r) => r > 0))

describe("Money.allocate properties", () => {
  it("parts always sum to the whole", () => {
    fc.assert(
      fc.property(amount, ratios, (money, rs) => {
        const total = Money.allocate(money, rs).reduce(Money.add, Money.eur(0n))
        expect(total).toEqual(money)
      }),
    )
  })

  it("each part is within one cent of its exact proportional share", () => {
    fc.assert(
      fc.property(amount, ratios, (money, rs) => {
        const weightSum = BigInt(rs.reduce((a, b) => a + b, 0))
        Money.allocate(money, rs).forEach((part, i) => {
          // |part - money * r / sum| < 1 cent, compared without division
          const exactScaled = money.cents * BigInt(rs[i] ?? 0)
          const diff = part.cents * weightSum - exactScaled
          expect(diff < 0n ? -diff : diff).toBeLessThan(weightSum)
        })
      }),
    )
  })

  it("a part with ratio zero gets nothing", () => {
    fc.assert(
      fc.property(amount, ratios, (money, rs) => {
        const zeroRatioParts = Money.allocate(money, rs).filter((_, i) => rs[i] === 0)
        expect(zeroRatioParts).toEqual(zeroRatioParts.map(() => Money.eur(0n)))
      }),
    )
  })
})
