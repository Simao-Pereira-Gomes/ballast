import { describe, expect, it } from "vitest"
import { accountsWithRole, countByRole } from "./account-filter.ts"

const accounts = [
  { id: "1", role: "operating_cash" },
  { id: "2", role: "reserve" },
  { id: "3", role: "reserve" },
] as const

describe("countByRole", () => {
  it("counts every Account Role, including those with no Accounts", () => {
    expect(countByRole(accounts)).toEqual({
      operating_cash: 1,
      reserve: 2,
      investment: 0,
      liability: 0,
    })
  })
})

describe("accountsWithRole", () => {
  it("keeps every Account when no role is chosen", () => {
    expect(accountsWithRole(accounts, "all")).toEqual(accounts)
  })

  it("keeps only the Accounts with the chosen role", () => {
    expect(accountsWithRole(accounts, "reserve").map((account) => account.id)).toEqual(["2", "3"])
    expect(accountsWithRole(accounts, "liability")).toEqual([])
  })
})
