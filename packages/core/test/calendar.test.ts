import { describe, expect, it } from "vitest"
import { formatDate } from "../src/index.ts"

describe("formatDate", () => {
  const date = Temporal.PlainDate.from("2026-10-31")

  it("formats a calendar date the Portuguese way", () => {
    expect(formatDate(date, "pt-PT")).toBe("31/10/2026")
  })

  it("formats a calendar date in English with the month spelled out", () => {
    expect(formatDate(date, "en")).toBe("31 Oct 2026")
  })
})
