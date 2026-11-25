import { describe, expect, it } from "vitest"
import { Money, accountBalance, findDiscrepancies } from "../src/index.ts"

const day = (iso: string) => Temporal.PlainDate.from(iso)
const tx = (date: string, euros: number) => ({
  date: day(date),
  amount: Money.eur(BigInt(Math.round(euros * 100))),
})
const checkpoint = (date: string, euros: number) => ({
  date: day(date),
  balance: Money.eur(BigInt(Math.round(euros * 100))),
})

describe("accountBalance", () => {
  it("is the sum of the Transactions when the bank has stated no balance", () => {
    expect(accountBalance([], [tx("2026-09-01", 100), tx("2026-09-02", -30)])).toEqual(
      Money.eur(7000n),
    )
  })

  it("is the bank's balance, whatever the Account held before its first Transaction", () => {
    // The Owner never entered an opening balance: the 1,000.00 includes it.
    const checkpoints = [checkpoint("2026-09-02", 1000)]
    expect(accountBalance(checkpoints, [tx("2026-09-01", 100), tx("2026-09-02", -30)])).toEqual(
      Money.eur(100000n),
    )
  })

  it("adds Transactions dated after the first Checkpoint", () => {
    const checkpoints = [checkpoint("2026-09-02", 1000)]
    expect(accountBalance(checkpoints, [tx("2026-09-02", -30), tx("2026-09-05", -50)])).toEqual(
      Money.eur(95000n),
    )
  })
})

describe("findDiscrepancies", () => {
  const first = checkpoint("2026-09-02", 1000)

  it("finds none with a single Checkpoint, however many Transactions there are", () => {
    expect(findDiscrepancies([first], [tx("2026-09-01", 5), tx("2026-09-02", 7)])).toEqual([])
  })

  it("finds none when the Transactions add up to a later Checkpoint", () => {
    const later = checkpoint("2026-09-10", 920)
    const transactions = [tx("2026-09-05", -50), tx("2026-09-10", -30)]
    expect(findDiscrepancies([later, first], transactions)).toEqual([])
  })

  it("reports a missing Transaction with the date and the difference", () => {
    const later = checkpoint("2026-09-10", 920)
    expect(findDiscrepancies([first, later], [tx("2026-09-05", -50)])).toEqual([
      {
        date: day("2026-09-10"),
        stated: Money.eur(92000n),
        computed: Money.eur(95000n),
        difference: Money.eur(-3000n),
      },
    ])
  })

  it("reports a duplicated Transaction as a positive difference: too much was taken out", () => {
    const later = checkpoint("2026-09-10", 920)
    const transactions = [tx("2026-09-05", -50), tx("2026-09-10", -30), tx("2026-09-10", -30)]
    const [found] = findDiscrepancies([first, later], transactions)
    expect(found?.difference).toEqual(Money.eur(3000n))
  })

  it("clears once the missing Transaction is added", () => {
    const later = checkpoint("2026-09-10", 920)
    const before = [tx("2026-09-05", -50)]
    expect(findDiscrepancies([first, later], before)).toHaveLength(1)
    expect(findDiscrepancies([first, later], [...before, tx("2026-09-10", -30)])).toEqual([])
  })

  it("ignores Transactions on or before the first Checkpoint's date", () => {
    const later = checkpoint("2026-09-10", 950)
    const transactions = [tx("2026-08-01", 999), tx("2026-09-02", 1), tx("2026-09-05", -50)]
    expect(findDiscrepancies([first, later], transactions)).toEqual([])
  })

  it("reports every Checkpoint that is off, oldest first", () => {
    const checkpoints = [checkpoint("2026-09-20", 0), first, checkpoint("2026-09-10", 1)]
    const found = findDiscrepancies(checkpoints, [])
    expect(found.map((d) => d.date.toString())).toEqual(["2026-09-10", "2026-09-20"])
  })
})
