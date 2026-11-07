/**
 * The Statement Parser. Each bank's layout is a `StatementFormat`;
 * `parseStatement` tries every known format, so the Owner never picks one and
 * a new bank is a new format, with no change to anything that reads lines.
 */
import { Option, Result } from "effect"
import { santander } from "./santander.ts"
import { InvalidImport } from "./statement.ts"
import type { Cell, Grid, Statement, StatementFormat } from "./statement.ts"

/** Every format Ballast can read. */
export const statementFormats: readonly StatementFormat[] = [santander]

const isFilled = (cell: Cell | undefined): cell is string =>
  cell !== null && cell !== undefined && cell.trim() !== ""

/**
 * The texts of the row that most looks like a header: among the first rows,
 * the first with the most filled cells (title rows above a header are narrower).
 */
const likelyHeaders = (grid: Grid): readonly string[] => {
  let best: readonly string[] = []
  for (const cells of grid.rows.slice(0, 30)) {
    const filled = cells.filter(isFilled).map((cell) => cell.trim())
    if (filled.length > best.length) best = filled
  }
  return best.length >= 2 ? best : []
}

/**
 * Reads a bank export with the first format whose layout it is in. Fails
 * with every problem found, or with `unrecognised_layout` naming the headers
 * it saw when no format knows the layout.
 */
export const parseStatement = (
  grid: Grid,
  formats: readonly StatementFormat[] = statementFormats,
): Result.Result<Statement, InvalidImport> => {
  for (const format of formats) {
    const read = format.read(grid)
    if (Option.isSome(read)) return read.value
  }
  return Result.fail(
    new InvalidImport({
      problems: [{ problem: "unrecognised_layout", headers: likelyHeaders(grid) }],
    }),
  )
}
