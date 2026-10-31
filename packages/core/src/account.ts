import { Data, Result, Schema, SchemaIssue } from "effect"
import { Currency } from "./money.ts"
import type { OwnerId } from "./owner.ts"

export const AccountId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("AccountId"))
export type AccountId = typeof AccountId.Type

export const AccountRole = Schema.Literals(["operating_cash", "reserve", "investment", "liability"])
export type AccountRole = typeof AccountRole.Type

export const accountRoles: readonly AccountRole[] = AccountRole.literals

const AccountName = Schema.Trim.check(
  Schema.isNonEmpty({ message: "required" }),
  Schema.isMaxLength(100, { message: "too_long" }),
)

const NewAccountSchema = Schema.Struct({
  name: AccountName,
  role: AccountRole.annotate({ message: "required" }),
  currency: Currency.annotate({ message: "unsupported" }),
})

export type NewAccount = typeof NewAccountSchema.Type

export interface Account {
  readonly id: AccountId
  readonly ownerId: OwnerId
  readonly name: string
  readonly role: AccountRole
  readonly currency: Currency
}

export type AccountProblem =
  | { readonly field: "name"; readonly problem: "required" | "too_long" }
  | { readonly field: "role"; readonly problem: "required" }
  | { readonly field: "currency"; readonly problem: "unsupported" }

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
      throw new Error(`decodeNewAccount: unexpected problem at "${field}": ${code}`)
  }
}

export const decodeNewAccount = (input: unknown): Result.Result<NewAccount, InvalidAccount> =>
  Schema.decodeUnknownResult(NewAccountSchema)(input, { errors: "all" }).pipe(
    Result.mapError(
      (error) =>
        new InvalidAccount({
          problems: formatIssue(error.issue).issues.map((issue) =>
            toProblem((issue.path ?? []).map(String).join("."), issue.message),
          ),
        }),
    ),
  )
