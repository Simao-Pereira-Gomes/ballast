import { Data, Result, Schema, SchemaIssue } from "effect"
import * as InterestRate from "./interest-rate.ts"
import { Currency, negate, subtract } from "./money.ts"
import type { Money } from "./money.ts"
import type { OwnerId } from "./owner.ts"

export const AccountId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("AccountId"))
export type AccountId = typeof AccountId.Type

/** What an Account's money is for. Advice depends on it. */
export const AccountRole = Schema.Literals(["operating_cash", "reserve", "investment", "liability"])
export type AccountRole = typeof AccountRole.Type

export const accountRoles: readonly AccountRole[] = AccountRole.literals

const AccountName = Schema.Trim.check(
  Schema.isNonEmpty({ message: "required" }),
  Schema.isMaxLength(100, { message: "too_long" }),
)

const AccountChangesSchema = Schema.Struct({
  name: AccountName,
  role: AccountRole.annotate({ message: "required" }),
})

const NewAccountSchema = Schema.Struct({
  ...AccountChangesSchema.fields,
  currency: Currency.annotate({ message: "unsupported" }),
})

/**
 * The terms that only make sense for some Roles: today, the optional
 * interest rate of a Liability, `null` on every other Role. An Investment's
 * Asset Mix comes from its Holdings instead (ADR 0007).
 */
export interface AccountTerms {
  readonly interestRate: InterestRate.InterestRate | null
}

/** What the Owner may change about an Account after opening it. */
export interface AccountChanges extends AccountTerms {
  readonly name: string
  readonly role: AccountRole
}

/** What the Owner gives when opening an Account. */
export interface NewAccount extends AccountChanges {
  readonly currency: Currency
}

export interface Account extends AccountTerms {
  readonly id: AccountId
  readonly ownerId: OwnerId
  readonly name: string
  readonly role: AccountRole
  readonly currency: Currency
  /**
   * A closed Account. It keeps its Transactions but is left out of active
   * lists and of advice.
   */
  readonly archived: boolean
}

export type AccountProblem =
  | { readonly field: "name"; readonly problem: "required" | "too_long" }
  | { readonly field: "role"; readonly problem: "required" }
  /** An Investment with Holdings can't change Role until they are removed. */
  | { readonly field: "role"; readonly problem: "has_holdings" }
  | { readonly field: "currency"; readonly problem: "unsupported" }
  | { readonly field: "interestRate"; readonly problem: "invalid" }

export class InvalidAccount extends Data.TaggedError("InvalidAccount")<{
  readonly problems: readonly AccountProblem[]
}> {}

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1()

const toProblem = (field: string, code: string): AccountProblem => {
  switch (field) {
    case "name":
      return { field, problem: code === "too_long" ? "too_long" : "required" }
    case "role":
      return { field, problem: "required" }
    case "currency":
      return { field, problem: "unsupported" }
    default:
      throw new Error(`decodeAccount: unexpected problem at "${field}": ${code}`)
  }
}

const field = (input: unknown, key: string): unknown =>
  typeof input === "object" && input !== null ? Reflect.get(input, key) : undefined

const text = (input: unknown, key: string): string => {
  const value = field(input, key)
  return typeof value === "string" ? value.trim() : ""
}

type Checked<A> = Result.Result<A, AccountProblem>

const checkInterestRate = (input: unknown): Checked<InterestRate.InterestRate | null> => {
  const rateText = text(input, "interestRate")
  if (rateText === "") return Result.succeed(null)
  const rate = InterestRate.parse(rateText)
  return rate === undefined
    ? Result.fail({ field: "interestRate", problem: "invalid" })
    : Result.succeed(rate)
}

/** The terms the Role takes, from what was submitted. Terms for other Roles are dropped. */
const checkTerms = (role: AccountRole | undefined, input: unknown) => ({
  interestRate: role === "liability" ? checkInterestRate(input) : Result.succeed(null),
})

const decodeWith =
  <A extends { readonly role: AccountRole }>(schema: Schema.Codec<A, unknown>) =>
  (input: unknown): Result.Result<A & AccountTerms, InvalidAccount> => {
    const base = Schema.decodeUnknownResult(schema)(input, { errors: "all" })
    // An unknown Role has no terms to check; the Role problem is enough.
    const role = Schema.decodeUnknownOption(AccountRole)(field(input, "role"))
    const { interestRate } = checkTerms(role._tag === "Some" ? role.value : undefined, input)
    if (Result.isSuccess(base) && Result.isSuccess(interestRate)) {
      return Result.succeed({ ...base.success, interestRate: interestRate.success })
    }
    const problems: AccountProblem[] = Result.isFailure(base)
      ? formatIssue(base.failure.issue).issues.map((issue) =>
          toProblem((issue.path ?? []).map(String).join("."), issue.message),
        )
      : []
    if (Result.isFailure(interestRate)) problems.push(interestRate.failure)
    return Result.fail(new InvalidAccount({ problems }))
  }

/**
 * Checks what the Owner gives when opening an Account: a name, a Role, a
 * currency and, for a Liability, its optional interest rate.
 */
export const decodeNewAccount: (input: unknown) => Result.Result<NewAccount, InvalidAccount> =
  decodeWith(NewAccountSchema)

/**
 * Checks a change to an Account: its name, its Role and the terms of that
 * Role. Changing away from Liability drops its interest rate.
 */
export const decodeAccountChanges: (
  input: unknown,
) => Result.Result<AccountChanges, InvalidAccount> = decodeWith(AccountChangesSchema)

/**
 * An Investment Account's market value: the sum of its Holdings' values,
 * as current as the oldest of them (ADR 0007).
 */
export interface Valuation {
  readonly value: Money
  readonly oldestValuedOn: Temporal.PlainDate
}

/**
 * An Account with its balance, the sum of its Transactions, and for an
 * Investment with Holdings, its Valuation.
 */
export interface AccountSummary extends Account {
  readonly balance: Money
  readonly valuation: Valuation | null
}

/** No Account with this id belongs to the Owner. */
export class AccountNotFound extends Data.TaggedError("AccountNotFound")<{
  readonly accountId: string
}> {}

/**
 * An Investment's Net Contributions: the net of its Transactions, i.e. the
 * money put in minus the money taken out. `null` on every other Role.
 */
export const netContributions = (account: AccountSummary): Money | null =>
  account.role === "investment" ? account.balance : null

/**
 * An Investment's Market Gain: its Valuation minus its Net Contributions,
 * negative for a loss. Never Revenue or Expense. `null` without a Valuation.
 */
export const marketGain = (account: AccountSummary): Money | null =>
  account.role === "investment" && account.valuation !== null
    ? subtract(account.valuation.value, account.balance)
    : null

/**
 * What the Owner owes on a Liability: its balance with the sign flipped, so
 * a card with €300 of charges owes €300. `null` on every other Role.
 */
export const amountOwed = (account: AccountSummary): Money | null =>
  account.role === "liability" ? negate(account.balance) : null
