import { maxDescriptionLength, maxImportMegabytes } from "@ballast/core"
import type { ImportProblem } from "@ballast/core"
import { m } from "@/paraglide/messages.js"

type LineCode = Extract<ImportProblem, { row: number }>["problem"]
type FileCode = Exclude<ImportProblem, { row: number }>["problem"]

// One table per kind, so a new code fails to compile until it has a message.
const line: Record<LineCode, (inputs: { row: string }) => string> = {
  invalid_date: m.import_problem_invalid_date,
  invalid_amount: m.import_problem_invalid_amount,
  zero_amount: m.import_problem_zero_amount,
  missing_description: m.import_problem_missing_description,
  description_too_long: ({ row }) =>
    m.import_problem_description_too_long({ row, limit: maxDescriptionLength.toString() }),
  incomplete_line: m.import_problem_incomplete_line,
  balance_mismatch: m.import_problem_balance_mismatch,
  already_imported: m.import_problem_already_imported,
}

const file: Record<Exclude<FileCode, "unrecognised_layout">, () => string> = {
  no_lines: m.import_problem_no_lines,
  unsupported_file: m.import_problem_unsupported_file,
  file_too_large: () => m.import_problem_file_too_large({ limit: maxImportMegabytes.toString() }),
  unreadable_file: m.import_problem_unreadable_file,
  account_archived: m.import_problem_account_archived,
}

/** The message for an Import problem code from the core, in the interface language. */
export const importProblemMessage = (problem: ImportProblem): string => {
  if ("row" in problem) return line[problem.problem]({ row: problem.row.toString() })
  if (problem.problem === "unrecognised_layout") {
    return problem.headers.length === 0
      ? m.import_problem_unrecognised_empty()
      : m.import_problem_unrecognised_layout({ headers: problem.headers.join(" · ") })
  }
  return file[problem.problem]()
}
