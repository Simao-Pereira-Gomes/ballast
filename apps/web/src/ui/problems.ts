import type { AccountProblem } from "@ballast/core"
import { m } from "@/paraglide/messages.js"

type CodesFor<Field extends AccountProblem["field"]> = Extract<
  AccountProblem,
  { field: Field }
>["problem"]

// One table per field, so a new field or code fails to compile until it has a message.
const name: Record<CodesFor<"name">, () => string> = {
  required: () => m.problem_name_required(),
  too_long: () => m.problem_name_too_long(),
}
const role: Record<CodesFor<"role">, () => string> = {
  required: () => m.problem_role_required(),
}
const currency: Record<CodesFor<"currency">, () => string> = {
  unsupported: () => m.problem_currency_unsupported(),
}

/** The message for a problem code from the core, in the interface language (ADR 0006). */
export const accountProblemMessage = (problem: AccountProblem): string => {
  if (problem.field === "name") return name[problem.problem]()
  if (problem.field === "role") return role[problem.problem]()
  return currency[problem.problem]()
}
