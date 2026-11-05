import type { TransactionProblem } from "@ballast/core"
import { m } from "@/paraglide/messages.js"

type CodesFor<Field extends TransactionProblem["field"]> = Extract<
  TransactionProblem,
  { field: Field }
>["problem"]

// One table per field, so a new field or code fails to compile until it has a message.
const date: Record<CodesFor<"date">, () => string> = {
  required: m.problem_date_required,
  invalid: m.problem_date_invalid,
}
const amount: Record<CodesFor<"amount">, () => string> = {
  required: m.problem_amount_required,
  invalid: m.problem_amount_invalid,
  zero: m.problem_amount_zero,
}
const direction: Record<CodesFor<"direction">, () => string> = {
  required: m.problem_direction_required,
}
const description: Record<CodesFor<"description">, () => string> = {
  required: m.problem_description_required,
  too_long: m.problem_description_too_long,
}

/** The message for a Transaction problem code from the core, in the interface language. */
export const transactionProblemMessage = (problem: TransactionProblem): string => {
  if (problem.field === "date") return date[problem.problem]()
  if (problem.field === "amount") return amount[problem.problem]()
  if (problem.field === "direction") return direction[problem.problem]()
  return description[problem.problem]()
}
