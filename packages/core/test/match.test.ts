import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  AccountId,
  ImportId,
  Money,
  OwnerId,
  TransactionId,
  mergeMatch,
  suggestMatches,
} from "../src/index.ts"
import type { Transaction } from "../src/index.ts"

const owner = Schema.decodeSync(OwnerId)("00000000-0000-4000-8000-000000000001")
const checking = Schema.decodeSync(AccountId)("00000000-0000-4000-8000-0000000000a1")
const savings = Schema.decodeSync(AccountId)("00000000-0000-4000-8000-0000000000a2")
const importId = Schema.decodeSync(ImportId)("00000000-0000-4000-8000-0000000000b1")

const id = (n: number) =>
  Schema.decodeSync(TransactionId)(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`)

const manual = (n: number, date: string, cents: bigint, accountId = checking): Transaction => ({
  id: id(n),
  ownerId: owner,
  accountId,
  date: Temporal.PlainDate.from(date),
  amount: Money.eur(cents),
  description: "coffee",
  source: "manual",
  importId: null,
  notes: null,
})

const imported = (n: number, date: string, cents: bigint, accountId = checking): Transaction => ({
  ...manual(n, date, cents, accountId),
  description: "COMPRA CAFE",
  source: "import",
  importId,
})

describe("suggestMatches", () => {
  it("pairs a manual and an imported Transaction up to three days apart, not four", () => {
    const m = manual(1, "2026-09-10", -1250n)

    expect(suggestMatches([m, imported(2, "2026-09-13", -1250n)], [])).toEqual([
      { manualId: id(1), importedId: id(2), daysApart: 3 },
    ])
    expect(suggestMatches([m, imported(2, "2026-09-07", -1250n)], [])).toEqual([
      { manualId: id(1), importedId: id(2), daysApart: 3 },
    ])
    expect(suggestMatches([m, imported(2, "2026-09-14", -1250n)], [])).toEqual([])
    expect(suggestMatches([m, imported(2, "2026-09-06", -1250n)], [])).toEqual([])
  })

  it("needs the same Account and the same signed amount", () => {
    const m = manual(1, "2026-09-10", -1250n)

    expect(suggestMatches([m, imported(2, "2026-09-10", -1251n)], [])).toEqual([])
    expect(suggestMatches([m, imported(2, "2026-09-10", 1250n)], [])).toEqual([])
    expect(suggestMatches([m, imported(2, "2026-09-10", -1250n, savings)], [])).toEqual([])
  })

  it("suggests every candidate pair, closest dates first, then the older manual entry", () => {
    // Two manual coffees, one bank line: both are offered, the nearer one first.
    const transactions = [
      manual(1, "2026-09-03", -1250n),
      manual(2, "2026-09-04", -1250n),
      imported(3, "2026-09-04", -1250n),
    ]
    expect(suggestMatches(transactions, [])).toEqual([
      { manualId: id(2), importedId: id(3), daysApart: 0 },
      { manualId: id(1), importedId: id(3), daysApart: 1 },
    ])

    // One manual entry, two bank lines the same distance away: older manual entry
    // first, and among equals the older imported line.
    const reverse = [
      manual(1, "2026-09-10", -500n),
      imported(2, "2026-09-12", -500n),
      imported(3, "2026-09-08", -500n),
    ]
    expect(suggestMatches(reverse, [])).toEqual([
      { manualId: id(1), importedId: id(3), daysApart: 2 },
      { manualId: id(1), importedId: id(2), daysApart: 2 },
    ])
  })

  it("leaves out pairs the Owner has rejected, and only those", () => {
    const transactions = [
      manual(1, "2026-09-03", -1250n),
      manual(2, "2026-09-04", -1250n),
      imported(3, "2026-09-04", -1250n),
    ]
    expect(suggestMatches(transactions, [{ manualId: id(2), importedId: id(3) }])).toEqual([
      { manualId: id(1), importedId: id(3), daysApart: 1 },
    ])
  })

  it("never pairs two manual Transactions, or two imported ones", () => {
    expect(
      suggestMatches([manual(1, "2026-09-10", -1250n), manual(2, "2026-09-10", -1250n)], []),
    ).toEqual([])
    expect(
      suggestMatches([imported(1, "2026-09-10", -1250n), imported(2, "2026-09-10", -1250n)], []),
    ).toEqual([])
  })
})

describe("mergeMatch", () => {
  it("keeps the bank's date, amount and description and the manual description as a note", () => {
    const m = manual(1, "2026-09-10", -1250n)
    const i = imported(2, "2026-09-12", -1250n)

    const { merged, snapshot } = mergeMatch(m, i)

    expect(merged).toEqual({ ...i, notes: "coffee" })
    expect(snapshot).toEqual({
      date: m.date,
      amount: m.amount,
      description: "coffee",
      notes: null,
    })
  })

  it("appends the manual description after notes the Owner already wrote", () => {
    const m = { ...manual(1, "2026-09-10", -1250n), notes: "with Ana" }

    expect(mergeMatch(m, imported(2, "2026-09-10", -1250n)).merged.notes).toBe("with Ana\ncoffee")
  })
})
