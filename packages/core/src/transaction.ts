import { Data, Result, Schema } from "effect"
import type { AccountId } from "./account.ts"
import * as Money from "./money.ts"
import type { OwnerId } from "./owner.ts"

export const TransactionId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand("TransactionId"),
)
export type TransactionId = typeof TransactionId.Type

/** Whether money came into the Account or left it. */
export const Direction = Schema.Literals(["inflow", "outflow"])
export type Direction = typeof Direction.Type

export const directions: readonly Direction[] = Direction.literals

/** Where a Transaction came from: typed in by the Owner, or from an Import. */
export const TransactionSource = Schema.Literals(["manual", "import"])
export type TransactionSource = typeof TransactionSource.Type

export interface Transaction {
  readonly id: TransactionId
  readonly ownerId: OwnerId
  readonly accountId: AccountId
  readonly date: Temporal.PlainDate
  /** Signed: positive for an inflow, negative for an outflow. Never zero. */
  readonly amount: Money.Money
  readonly description: string
  readonly source: TransactionSource
}

/** What the Owner enters for a manual Transaction, once checked. */
export interface TransactionDetails {
  readonly date: Temporal.PlainDate
  readonly amount: Money.Money
  readonly description: string
}

export type TransactionProblem =
  | { readonly field: "date"; readonly problem: "required" | "invalid" }
  | { readonly field: "amount"; readonly problem: "required" | "invalid" | "zero" }
  | { readonly field: "direction"; readonly problem: "required" }
  | { readonly field: "description"; readonly problem: "required" | "too_long" }

export class InvalidTransaction extends Data.TaggedError("InvalidTransaction")<{
  readonly problems: readonly TransactionProblem[]
}> {}

/** The longest description a Transaction can have. */
export const maxDescriptionLength = 200

const isoDate = /^\d{4}-\d{2}-\d{2}$/

const text = (input: unknown, key: string): string => {
  if (typeof input !== "object" || input === null || !(key in input)) return ""
  const value: unknown = Reflect.get(input, key)
  return typeof value === "string" ? value.trim() : ""
}

const parseDate = (value: string): Temporal.PlainDate | undefined => {
  if (!isoDate.test(value)) return undefined
  try {
    return Temporal.PlainDate.from(value, { overflow: "reject" })
  } catch {
    return undefined
  }
}

/**
 * Checks what the Owner entered for a manual Transaction: an ISO calendar
 * date, a positive amount with at most two decimals ("12", "12.3", "12,34"),
 * a direction and a description. The direction gives the amount its sign.
 */
export const decodeTransactionDetails = (
  input: unknown,
): Result.Result<TransactionDetails, InvalidTransaction> => {
  const problems: TransactionProblem[] = []

  const dateText = text(input, "date")
  const date = parseDate(dateText)
  if (date === undefined) {
    problems.push({ field: "date", problem: dateText === "" ? "required" : "invalid" })
  }

  const amountText = text(input, "amount")
  const amount = Money.parse(amountText, "EUR")
  if (amount === undefined) {
    problems.push({ field: "amount", problem: amountText === "" ? "required" : "invalid" })
  } else if (amount.cents === 0n) {
    problems.push({ field: "amount", problem: "zero" })
  }

  const direction = Schema.decodeUnknownOption(Direction)(text(input, "direction"))
  if (direction._tag === "None") problems.push({ field: "direction", problem: "required" })

  const description = text(input, "description")
  if (description === "") problems.push({ field: "description", problem: "required" })
  else if (description.length > maxDescriptionLength) {
    problems.push({ field: "description", problem: "too_long" })
  }

  if (
    problems.length > 0 ||
    date === undefined ||
    amount === undefined ||
    direction._tag === "None"
  ) {
    return Result.fail(new InvalidTransaction({ problems }))
  }
  return Result.succeed({
    date,
    amount: direction.value === "outflow" ? Money.negate(amount) : amount,
    description,
  })
}

/** No manual Transaction with this id belongs to the Owner. */
export class TransactionNotFound extends Data.TaggedError("TransactionNotFound")<{
  readonly transactionId: string
}> {}
