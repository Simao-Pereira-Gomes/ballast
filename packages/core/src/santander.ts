/**
 * Santander Portugal's Excel movements export (mapping on issue #3).
 *
 * The header texts follow the language the bank's site was set to, so the
 * layout is recognised by its structure, not its headers: a row of five
 * texts followed by lines of operation date, value date, description,
 * signed amount and running balance. Dates are text `DD-MM-YYYY`, amounts
 * exact decimal strings, and lines run newest first.
 */
import { Option, Result } from "effect"
import { normaliseDescription } from "./description.ts"
import * as Money from "./money.ts"
import { InvalidImport } from "./statement.ts"
import type {
  Cell,
  Grid,
  ImportProblem,
  LineProblem,
  Statement,
  StatementFormat,
  StatementLine,
} from "./statement.ts"
import { maxDescriptionLength } from "./transaction.ts"

const columnCount = 5
const dateShape = /^(\d{2})-(\d{2})-(\d{4})$/
const decimalShape = /^-?\d+(?:\.\d+)?$/
/** A signed amount with up to two decimals after a point, as the decoder writes numbers. */
const amountShape = /^(-?)(\d+(?:\.\d{1,2})?)$/

const text = (cell: Cell | undefined): string => (cell ?? "").trim()

const isEmpty = (row: readonly Cell[]): boolean => row.every((cell) => text(cell) === "")

const isHeader = (row: readonly Cell[]): boolean =>
  row.length >= columnCount &&
  row.every((cell, column) => {
    const value = text(cell)
    if (column >= columnCount) return value === ""
    return value !== "" && !dateShape.test(value) && !decimalShape.test(value)
  })

const isLineShaped = (row: readonly Cell[]): boolean =>
  dateShape.test(text(row[0])) &&
  dateShape.test(text(row[1])) &&
  decimalShape.test(text(row[3])) &&
  decimalShape.test(text(row[4]))

/**
 * The index of the header row: the first row of five texts after which every
 * row is empty or at least one has the shape of a statement line.
 */
const findHeader = (grid: Grid): number | undefined => {
  const index = grid.rows.findIndex((row, at) => {
    if (!isHeader(row)) return false
    const after = grid.rows.slice(at + 1).filter((next) => !isEmpty(next))
    return after.length === 0 || after.some(isLineShaped)
  })
  return index === -1 ? undefined : index
}

const parseDate = (cell: Cell | undefined): Temporal.PlainDate | undefined => {
  const match = dateShape.exec(text(cell))
  if (match === null) return undefined
  const [, day = "", month = "", year = ""] = match
  try {
    return Temporal.PlainDate.from(
      { year: Number(year), month: Number(month), day: Number(day) },
      { overflow: "reject" },
    )
  } catch {
    return undefined
  }
}

const parseAmount = (cell: Cell | undefined): Money.Money | undefined => {
  const match = amountShape.exec(text(cell))
  if (match === null) return undefined
  const [, sign = "", magnitude = ""] = match
  const amount = Money.parse(magnitude, "EUR")
  return amount === undefined || sign === "" ? amount : Money.negate(amount)
}

/** A statement line as read, with the running balance after it. */
interface ValidLine extends StatementLine {
  readonly balance: Money.Money
}

interface ReadLine {
  readonly row: number
  readonly amount: Money.Money | undefined
  readonly balance: Money.Money | undefined
  /** The line, when it has no problems. */
  readonly valid: ValidLine | undefined
  readonly problems: readonly ImportProblem[]
}

const readLine = (cells: readonly Cell[], row: number): ReadLine => {
  const problem = (kind: LineProblem) => ({ row, problem: kind })
  const others = [0, 1, 3, 4].map((column) => text(cells[column]))
  if (others.some((value) => value === "")) {
    const problems = [problem("incomplete_line")]
    return { row, amount: undefined, balance: undefined, valid: undefined, problems }
  }

  const problems: ImportProblem[] = []
  const date = parseDate(cells[0])
  if (date === undefined || parseDate(cells[1]) === undefined)
    problems.push(problem("invalid_date"))
  const description = text(cells[2])
  if (description === "") problems.push(problem("missing_description"))
  else if (description.length > maxDescriptionLength) {
    problems.push(problem("description_too_long"))
  }
  const amount = parseAmount(cells[3])
  const balance = parseAmount(cells[4])
  if (amount === undefined || balance === undefined) problems.push(problem("invalid_amount"))
  else if (amount.cents === 0n) problems.push(problem("zero_amount"))

  const valid =
    problems.length === 0 && date !== undefined && amount !== undefined && balance !== undefined
      ? {
          row,
          date,
          amount,
          balance,
          description,
          descriptionKey: normaliseDescription(description),
        }
      : undefined
  return { row, amount, balance, valid, problems }
}

/**
 * Each line's balance must be the next older line's balance plus its own
 * amount. A break means a line is missing, changed or out of order.
 */
const chainProblems = (newestFirst: readonly ReadLine[]): ImportProblem[] =>
  newestFirst.flatMap((line, index) => {
    const older = newestFirst[index + 1]
    if (
      older === undefined ||
      line.amount === undefined ||
      line.balance === undefined ||
      older.balance === undefined
    ) {
      return []
    }
    return Money.equals(Money.add(older.balance, line.amount), line.balance)
      ? []
      : [{ row: line.row, problem: "balance_mismatch" as const }]
  })

const rowOf = (problem: ImportProblem): number => ("row" in problem ? problem.row : 0)

const read = (grid: Grid, header: number): Result.Result<Statement, InvalidImport> => {
  const newestFirst = grid.rows
    .map((cells, index) => ({ cells, row: index + 1 }))
    .slice(header + 1)
    .filter(({ cells }) => !isEmpty(cells))
    .map(({ cells, row }) => readLine(cells, row))

  const problems = [...newestFirst.flatMap((line) => line.problems), ...chainProblems(newestFirst)]
  if (problems.length > 0) {
    const byRow = problems.toSorted((a, b) => rowOf(a) - rowOf(b))
    return Result.fail(new InvalidImport({ problems: byRow }))
  }

  const chronological = newestFirst
    .flatMap((line) => (line.valid === undefined ? [] : [line.valid]))
    .toReversed()
  const [oldest, ...rest] = chronological
  const newest = chronological.at(-1)
  if (oldest === undefined || newest === undefined) {
    return Result.fail(new InvalidImport({ problems: [{ problem: "no_lines" }] }))
  }
  const withoutBalance = ({ balance: _balance, ...line }: ValidLine): StatementLine => line
  return Result.succeed({
    format: santander.name,
    lines: [withoutBalance(oldest), ...rest.map(withoutBalance)],
    balanceCheckpoint: { date: newest.date, balance: newest.balance },
  })
}

export const santander: StatementFormat = {
  name: "santander",
  read: (grid) =>
    Option.map(Option.fromUndefinedOr(findHeader(grid)), (header) => read(grid, header)),
}
