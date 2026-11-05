import { Data, Result, Schema, SchemaIssue } from "effect"
import * as InterestRate from "./interest-rate.ts"
import { Currency } from "./money.ts"
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

/** What an Investment's money is invested in. */
export const AssetClass = Schema.Literals(["equity", "bonds", "cash", "crypto", "other"])
export type AssetClass = typeof AssetClass.Type

export const assetClasses: readonly AssetClass[] = AssetClass.literals

/**
 * How an Investment Account splits across asset classes, in whole
 * percentages that add up to 100, e.g. 80% equity and 20% bonds.
 */
export type AssetMix = Readonly<Record<AssetClass, number>>

/**
 * The terms that only make sense for some Roles: the interest rate of a
 * Liability and the asset-class mix of an Investment. Both are optional and
 * `null` on every other Role.
 */
export interface AccountTerms {
  readonly interestRate: InterestRate.InterestRate | null
  readonly assetMix: AssetMix | null
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
  | { readonly field: "currency"; readonly problem: "unsupported" }
  | { readonly field: "interestRate"; readonly problem: "invalid" }
  | { readonly field: "assetMix"; readonly problem: "invalid" }
  | { readonly field: "assetMix"; readonly problem: "not_100"; readonly total: number }

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

const wholePercentage = /^\d{1,3}$/

/**
 * Reads one asset class's share as the Owner typed it: a whole percentage
 * from 0 to 100, where blank means 0. Returns `undefined` for anything else.
 */
export const parseAssetShare = (typed: string): number | undefined => {
  const trimmed = typed.trim()
  if (trimmed === "") return 0
  const percent = wholePercentage.test(trimmed) ? Number(trimmed) : 101
  return percent <= 100 ? percent : undefined
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

const checkAssetMix = (input: unknown): Checked<AssetMix | null> => {
  const submitted = field(input, "assetMix")
  const texts = assetClasses.map((assetClass) => text(submitted, assetClass))
  if (texts.every((percentText) => percentText === "")) return Result.succeed(null)
  const entries: [AssetClass, number][] = []
  for (const [index, assetClass] of assetClasses.entries()) {
    const percent = parseAssetShare(texts[index] ?? "")
    if (percent === undefined) return Result.fail({ field: "assetMix", problem: "invalid" })
    entries.push([assetClass, percent])
  }
  const total = entries.reduce((sum, [, percent]) => sum + percent, 0)
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- one entry per asset class, so every key is present
  const mix = Object.fromEntries(entries) as AssetMix
  return total === 100
    ? Result.succeed(mix)
    : Result.fail({ field: "assetMix", problem: "not_100", total })
}

/** The terms the Role takes, from what was submitted. Terms for other Roles are dropped. */
const checkTerms = (role: AccountRole | undefined, input: unknown) => ({
  interestRate: role === "liability" ? checkInterestRate(input) : Result.succeed(null),
  assetMix: role === "investment" ? checkAssetMix(input) : Result.succeed(null),
})

const decodeWith =
  <A extends { readonly role: AccountRole }>(schema: Schema.Codec<A, unknown>) =>
  (input: unknown): Result.Result<A & AccountTerms, InvalidAccount> => {
    const base = Schema.decodeUnknownResult(schema)(input, { errors: "all" })
    // An unknown Role has no terms to check; the Role problem is enough.
    const role = Schema.decodeUnknownOption(AccountRole)(field(input, "role"))
    const { interestRate, assetMix } = checkTerms(
      role._tag === "Some" ? role.value : undefined,
      input,
    )
    if (Result.isSuccess(base) && Result.isSuccess(interestRate) && Result.isSuccess(assetMix)) {
      return Result.succeed({
        ...base.success,
        interestRate: interestRate.success,
        assetMix: assetMix.success,
      })
    }
    const problems: AccountProblem[] = Result.isFailure(base)
      ? formatIssue(base.failure.issue).issues.map((issue) =>
          toProblem((issue.path ?? []).map(String).join("."), issue.message),
        )
      : []
    if (Result.isFailure(interestRate)) problems.push(interestRate.failure)
    if (Result.isFailure(assetMix)) problems.push(assetMix.failure)
    return Result.fail(new InvalidAccount({ problems }))
  }

/**
 * Checks what the Owner gives when opening an Account: a name, a Role, a
 * currency and, for a Liability or an Investment, its optional terms.
 */
export const decodeNewAccount: (input: unknown) => Result.Result<NewAccount, InvalidAccount> =
  decodeWith(NewAccountSchema)

/**
 * Checks a change to an Account: its name, its Role and the terms of that
 * Role. Changing away from Liability or Investment drops their terms.
 */
export const decodeAccountChanges: (
  input: unknown,
) => Result.Result<AccountChanges, InvalidAccount> = decodeWith(AccountChangesSchema)

/** An Account with its balance: the sum of its Transactions. */
export interface AccountSummary extends Account {
  readonly balance: Money
}

/** No Account with this id belongs to the Owner. */
export class AccountNotFound extends Data.TaggedError("AccountNotFound")<{
  readonly accountId: string
}> {}
