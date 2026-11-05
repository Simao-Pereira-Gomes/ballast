import { Result, Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  AccountId,
  Money,
  OwnerId,
  amountOwed,
  decodeAccountChanges,
  decodeNewAccount,
  marketGain,
  netContributions,
} from "../src/index.ts"
import type { AccountSummary } from "../src/index.ts"

const problemsOf = (result: Result.Result<unknown, { readonly problems: readonly unknown[] }>) =>
  Result.isFailure(result) ? result.failure.problems : []

const newAccountProblems = (input: unknown) => problemsOf(decodeNewAccount(input))
const changeProblems = (input: unknown) => problemsOf(decodeAccountChanges(input))

const noTerms = { interestRate: null }

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
    })
  })

  it("takes no typed terms for an Investment: its Asset Mix comes from Holdings", () => {
    const result = decodeNewAccount({
      name: "Brokerage",
      role: "investment",
      currency: "EUR",
      assetMix: { equity: "80", bonds: "20" },
    })
    expect(Result.getOrThrow(result)).toEqual({
      name: "Brokerage",
      role: "investment",
      currency: "EUR",
      ...noTerms,
    })
  })
})

describe("decodeAccountChanges", () => {
  const liability = { name: "Car loan", role: "liability" }

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

  it("reports name problems together with problems in the Role's terms", () => {
    expect(changeProblems({ name: "", role: "liability", interestRate: "x" })).toEqual([
      { field: "name", problem: "required" },
      { field: "interestRate", problem: "invalid" },
    ])
  })
})

describe("figures by Role", () => {
  const summary = (
    role: AccountSummary["role"],
    balanceCents: bigint,
    valuationCents: bigint | null = null,
  ): AccountSummary => ({
    id: Schema.decodeSync(AccountId)("00000000-0000-4000-8000-000000000000"),
    ownerId: Schema.decodeSync(OwnerId)("00000000-0000-4000-8000-000000000001"),
    name: "Account",
    role,
    currency: "EUR",
    interestRate: null,
    archived: false,
    balance: Money.eur(balanceCents),
    valuation:
      valuationCents === null
        ? null
        : {
            value: Money.eur(valuationCents),
            oldestValuedOn: Temporal.PlainDate.from("2026-11-01"),
          },
  })

  it("an Investment's Market Gain is its Valuation minus its Net Contributions", () => {
    const investment = summary("investment", 100_000n, 112_500n)
    expect(netContributions(investment)).toEqual(Money.eur(100_000n))
    expect(marketGain(investment)).toEqual(Money.eur(12_500n))
    expect(marketGain(summary("investment", 100_000n, 90_000n))).toEqual(Money.eur(-10_000n))
  })

  it("has no Market Gain without a Valuation, nor on other Roles", () => {
    expect(marketGain(summary("investment", 100_000n))).toBeNull()
    expect(marketGain(summary("reserve", 100_000n, 1n))).toBeNull()
    expect(netContributions(summary("reserve", 100_000n))).toBeNull()
  })

  it("a Liability owes its balance with the sign flipped", () => {
    expect(amountOwed(summary("liability", -30_000n))).toEqual(Money.eur(30_000n))
    expect(amountOwed(summary("operating_cash", -30_000n))).toBeNull()
  })
})
