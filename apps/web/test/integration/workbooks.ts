import type { Cell, Grid } from "@ballast/core"
import * as XLSX from "xlsx"
import english from "../../../../packages/core/test/fixtures/santander/movements-en.json" with { type: "json" }
import portuguese from "../../../../packages/core/test/fixtures/santander/movements-pt.json" with { type: "json" }

export { english, portuguese }

const decimal = /^-?\d+(?:\.\d+)?$/

/**
 * A `.xls` (BIFF8, as Santander exports) or `.xlsx` file of a synthetic
 * grid. Decimal strings in the amount and balance columns become numeric
 * cells, as in the real export; everything else stays text.
 */
export const workbookOf = (grid: Grid, bookType: "biff8" | "xlsx" = "biff8"): Uint8Array => {
  const rows = grid.rows.map((row) =>
    row.map((cell: Cell, column) =>
      cell !== null && column >= 3 && decimal.test(cell) ? Number(cell) : cell,
    ),
  )
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), grid.sheetName)
  const bytes: unknown = XLSX.write(book, { bookType, type: "array" })
  if (!(bytes instanceof ArrayBuffer)) throw new Error("SheetJS wrote no ArrayBuffer")
  return new Uint8Array(bytes)
}

/** The Portuguese fixture with some rows replaced, by their index in the grid. */
export const portugueseWith = (replacements: Record<number, readonly Cell[]>): Grid => ({
  ...portuguese,
  rows: portuguese.rows.map((row, index) => replacements[index] ?? row),
})
