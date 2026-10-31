import { Data, Result, Schema, SchemaIssue } from "effect"
import { Currency } from "./money.ts"
import type { OwnerId } from "./owner.ts"

export const AccountId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("AccountId"))
export type AccountId = typeof AccountId.Type

/** What an Account's money is for. Advice depends on it. */
export const AccountRole = Schema.Literals(["operating_cash", "reserve", "investment", "liability"])
export type AccountRole = typeof AccountRole.Type

export const accountRoles: readonly AccountRole[] = AccountRole.literals

const AccountName = Schema.Trim.check(
  Schema.isNonEmpty({ message: "Name is required" }),
  Schema.isMaxLength(100, { message: "Name must be at most 100 characters" }),
)

const NewAccountSchema = Schema.Struct({
  name: AccountName,
  role: AccountRole.annotate({ message: "Choose an Account Role" }),
  currency: Currency.annotate({ message: "Only EUR is supported" }),
})

export type NewAccount = typeof NewAccountSchema.Type

export interface Account {
  readonly id: AccountId
  readonly ownerId: OwnerId
  readonly name: string
  readonly role: AccountRole
  readonly currency: Currency
}

export interface Problem {
  readonly field: string
  readonly message: string
}

export class InvalidAccount extends Data.TaggedError("InvalidAccount")<{
  readonly problems: readonly Problem[]
}> {}

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1()

export const decodeNewAccount = (input: unknown): Result.Result<NewAccount, InvalidAccount> =>
  Schema.decodeUnknownResult(NewAccountSchema)(input, { errors: "all" }).pipe(
    Result.mapError(
      (error) =>
        new InvalidAccount({
          problems: formatIssue(error.issue).issues.map((problem) => ({
            field: (problem.path ?? []).map(String).join("."),
            message: problem.message,
          })),
        }),
    ),
  )
