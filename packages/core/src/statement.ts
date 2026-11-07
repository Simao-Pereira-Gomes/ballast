/**
 * What the Statement Parser reads and produces: the grid of cells decoded
 * from a bank export (ADR 0005), statement lines, and the problems that stop
 * a file from being imported.
 */
import { Data } from "effect"
import type { Option, Result } from "effect"
import * as Money from "./money.ts"

/**
 * A decoded cell: `null` when empty, otherwise its text, a number's exact
 * decimal string ("-48.9") or a date's ISO string.
 */
export type Cell = string | null

/** One worksheet of a bank export, every row of its used range, top to bottom. */
export interface Grid {
  readonly sheetName: string
  readonly rows: readonly (readonly Cell[])[]
}

/** One movement as the bank stated it. */
export interface StatementLine {
  /** The line's row in the spreadsheet, counting from 1 as the spreadsheet does. */
  readonly row: number
  readonly date: Temporal.PlainDate
  /** Signed: positive for money in, negative for money out. Never zero. */
  readonly amount: Money.Money
  /** As the bank wrote it, trimmed. */
  readonly description: string
  /** `normaliseDescription` of the description. */
  readonly descriptionKey: string
}

/** What a bank export says, once read. */
export interface Statement {
  /** Which `StatementFormat` read it. */
  readonly format: string
  /** Oldest first, in the order the bank booked them. Never empty. */
  readonly lines: readonly [StatementLine, ...StatementLine[]]
  /**
   * The Balance Checkpoint the export states: the bank's balance after the
   * newest line, on that line's date. Not stored yet (#9).
   */
  readonly balanceCheckpoint: { readonly date: Temporal.PlainDate; readonly balance: Money.Money }
}

/** The largest bank export accepted, in megabytes. A year of statements is tens of kilobytes. */
export const maxImportMegabytes = 5

/** Why a line of an export can't be imported. */
export type LineProblem =
  | "invalid_date"
  | "invalid_amount"
  | "zero_amount"
  | "missing_description"
  | "description_too_long"
  | "incomplete_line"
  | "balance_mismatch"
  /** A line that is already a Transaction on the Account. */
  | "already_imported"

/** Why a file can't be imported. Nothing is imported when there is any. */
export type ImportProblem =
  | { readonly row: number; readonly problem: LineProblem }
  | { readonly problem: "unrecognised_layout"; readonly headers: readonly string[] }
  | { readonly problem: "no_lines" }
  | { readonly problem: "unsupported_file" | "file_too_large" | "unreadable_file" }
  | { readonly problem: "account_archived" }

export class InvalidImport extends Data.TaggedError("InvalidImport")<{
  readonly problems: readonly ImportProblem[]
}> {}

/** One bank's export layout. */
export interface StatementFormat {
  readonly name: string
  /**
   * `None` when the grid isn't in this format's layout; otherwise the
   * statement, or every problem that stops its lines from being imported.
   */
  readonly read: (grid: Grid) => Option.Option<Result.Result<Statement, InvalidImport>>
}

/**
 * A fingerprint per line that identifies the movement on its Account: date,
 * amount, normalised description and, for identical lines, which occurrence
 * it is within the file. The same movement in another export of the same
 * period gets the same fingerprint.
 */
export const fingerprintLines = (
  lines: readonly Pick<StatementLine, "date" | "amount" | "descriptionKey">[],
): readonly string[] => {
  const seen = new Map<string, number>()
  return lines.map((line) => {
    const identity = `${line.date.toString()}|${line.amount.cents.toString()}|${line.descriptionKey}`
    const occurrence = seen.get(identity) ?? 0
    seen.set(identity, occurrence + 1)
    return `${identity}|${occurrence.toString()}`
  })
}

/** What a statement's lines moved: the sum of money in and of money out (negative). */
export const statementTotals = (
  lines: readonly Pick<StatementLine, "amount">[],
): { readonly moneyIn: Money.Money; readonly moneyOut: Money.Money } => {
  let moneyIn = Money.eur(0n)
  let moneyOut = Money.eur(0n)
  for (const { amount } of lines) {
    if (amount.cents > 0n) moneyIn = Money.add(moneyIn, amount)
    else moneyOut = Money.add(moneyOut, amount)
  }
  return { moneyIn, moneyOut }
}
