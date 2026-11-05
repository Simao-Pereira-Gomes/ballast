import { Result } from "effect"
import { describe, expect, it } from "vitest"
import { decodeAccountChanges, decodeNewAccount } from "../src/index.ts"

const problemsOf = (result: Result.Result<unknown, { readonly problems: readonly unknown[] }>) =>
  Result.isFailure(result) ? result.failure.problems : []

const newAccountProblems = (input: unknown) => problemsOf(decodeNewAccount(input))
const changeProblems = (input: unknown) => problemsOf(decodeAccountChanges(input))

const noTerms = { interestRate: null, assetMix: null }

describe("decodeNewAccount", () => {
  it("accepts valid details, trimming the name", () => {
    const result = decodeNewAccount({
      name: "  Santander Current ",
      role: "reserve",
      currency: "EUR",
    })
    expect(Result.getOrThrow(result)).toEqual({
      name: "Santander Current",
      role: "reserve",
      currency: "EUR",
      ...noTerms,
    })
  })

  it("names every problem as a code, never a sentence", () => {
    expect(newAccountProblems({ name: "   ", role: "savings", currency: "USD" })).toEqual([
      { field: "name", problem: "required" },
      { field: "role", problem: "required" },
      { field: "currency", problem: "unsupported" },
    ])
  })

  it("reports a name that is too long", () => {
    expect(newAccountProblems({ name: "x".repeat(101), role: "reserve", currency: "EUR" })).toEqual(
      [{ field: "name", problem: "too_long" }],
    )
  })

  it("treats missing fields as required", () => {
    expect(newAccountProblems({ currency: "EUR" })).toEqual([
      { field: "name", problem: "required" },
      { field: "role", problem: "required" },
    ])
  })

  it("keeps a Liability's interest rate", () => {
    const result = decodeNewAccount({
      name: "Card",
      role: "liability",
      currency: "EUR",
      interestRate: "18,5",
    })
    expect(Result.getOrThrow(result)).toMatchObject({
      interestRate: { basisPoints: 1850 },
      assetMix: null,
    })
  })

  it("keeps an Investment's asset-class mix", () => {
    const result = decodeNewAccount({
      name: "Brokerage",
      role: "investment",
      currency: "EUR",
      assetMix: { equity: "80", bonds: "20" },
    })
    expect(Result.getOrThrow(result)).toMatchObject({
      interestRate: null,
      assetMix: { equity: 80, bonds: 20, cash: 0, crypto: 0, other: 0 },
    })
  })
})

describe("decodeAccountChanges", () => {
  const liability = { name: "Car loan", role: "liability" }
  const investment = { name: "PPR", role: "investment" }

  it("accepts a new name and Role", () => {
    expect(Result.getOrThrow(decodeAccountChanges({ name: " Savings ", role: "reserve" }))).toEqual(
      { name: "Savings", role: "reserve", ...noTerms },
    )
  })

  it("reports name and Role problems", () => {
    expect(changeProblems({ name: "", role: "piggy_bank" })).toEqual([
      { field: "name", problem: "required" },
      { field: "role", problem: "required" },
    ])
  })

  describe("interest rate", () => {
    it("is optional on a Liability", () => {
      expect(
        Result.getOrThrow(decodeAccountChanges({ ...liability, interestRate: " " })),
      ).toMatchObject({ interestRate: null })
    })

    it("must be a percentage from 0 to 100 with up to two decimals", () => {
      for (const interestRate of ["abc", "-1", "101", "3.141"]) {
        expect(changeProblems({ ...liability, interestRate })).toEqual([
          { field: "interestRate", problem: "invalid" },
        ])
      }
    })

    it("is not kept on other Roles, whatever was submitted", () => {
      expect(
        Result.getOrThrow(
          decodeAccountChanges({ name: "Savings", role: "reserve", interestRate: "nonsense" }),
        ),
      ).toEqual({ name: "Savings", role: "reserve", ...noTerms })
    })
  })

  describe("asset-class mix", () => {
    it("is optional on an Investment", () => {
      expect(
        Result.getOrThrow(
          decodeAccountChanges({ ...investment, assetMix: { equity: "", bonds: " " } }),
        ),
      ).toMatchObject({ assetMix: null })
    })

    it("accepts a single asset class at 100%", () => {
      expect(
        Result.getOrThrow(decodeAccountChanges({ ...investment, assetMix: { equity: "100" } })),
      ).toMatchObject({ assetMix: { equity: 100, bonds: 0, cash: 0, crypto: 0, other: 0 } })
    })

    it("keeps crypto apart from the other asset classes", () => {
      expect(
        Result.getOrThrow(
          decodeAccountChanges({ ...investment, assetMix: { equity: "90", crypto: "10" } }),
        ),
      ).toMatchObject({ assetMix: { equity: 90, bonds: 0, cash: 0, crypto: 10, other: 0 } })
    })

    it("must add up to 100, and says what it adds up to", () => {
      expect(changeProblems({ ...investment, assetMix: { equity: "80", bonds: "30" } })).toEqual([
        { field: "assetMix", problem: "not_100", total: 110 },
      ])
      expect(changeProblems({ ...investment, assetMix: { cash: "0" } })).toEqual([
        { field: "assetMix", problem: "not_100", total: 0 },
      ])
    })

    it("takes whole percentages from 0 to 100 only", () => {
      for (const equity of ["50.5", "-10", "abc", "101"]) {
        expect(changeProblems({ ...investment, assetMix: { equity, bonds: "50" } })).toEqual([
          { field: "assetMix", problem: "invalid" },
        ])
      }
    })

    it("is not kept on other Roles", () => {
      expect(
        Result.getOrThrow(decodeAccountChanges({ ...liability, assetMix: { equity: "nonsense" } })),
      ).toEqual({ ...liability, ...noTerms })
    })
  })

  it("reports name problems together with problems in the Role's terms", () => {
    expect(changeProblems({ name: "", role: "liability", interestRate: "x" })).toEqual([
      { field: "name", problem: "required" },
      { field: "interestRate", problem: "invalid" },
    ])
  })
})
