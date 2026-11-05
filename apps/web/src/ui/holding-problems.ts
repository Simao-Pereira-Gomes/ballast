import type { HoldingProblem } from "@ballast/core"
import { m } from "@/paraglide/messages.js"

type CodesFor<Field extends HoldingProblem["field"]> = Extract<
  HoldingProblem,
  { field: Field }
>["problem"]

// One table per field, so a new field or code fails to compile until it has a message.
const messages: {
  readonly [Field in HoldingProblem["field"]]: Record<CodesFor<Field>, () => string>
} = {
  kind: { required: m.problem_holding_kind_required },
  name: { required: m.problem_name_required, too_long: m.problem_name_too_long },
  ticker: { invalid: m.problem_ticker_invalid },
  index: { required: m.problem_index_required, too_long: m.problem_index_too_long },
  assetClass: { required: m.problem_asset_class_required },
  units: { invalid: m.problem_units_invalid, zero: m.problem_units_zero },
  value: { required: m.problem_value_required, invalid: m.problem_amount_invalid },
  valuedOn: { required: m.problem_date_required, invalid: m.problem_date_invalid },
}

/** The message for a Holding problem code from the core, in the interface language. */
export const holdingProblemMessage = (problem: HoldingProblem): string => {
  const forField: Partial<Record<string, () => string>> = messages[problem.field]
  const message = forField[problem.problem]
  if (message === undefined) throw new Error(`No message for ${problem.field}.${problem.problem}`)
  return message()
}
