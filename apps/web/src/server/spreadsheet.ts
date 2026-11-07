import { InvalidImport } from "@ballast/core"
import type { Cell, Grid } from "@ballast/core"
import { Effect } from "effect"
import * as XLSX from "xlsx"

/**
 * Whether a number format shows a date: it has a day or year token once
 * quoted text, escapes and bracketed sections (colours, conditions) are
 * removed. Pure time formats stay numbers.
 */
const isDateFormat = (format: string): boolean =>
  /[dy]/i.test(format.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, ""))

/**
 * The calendar date of an Excel date serial: days since 1899-12-30 (which
 * absorbs Excel's phantom 29 February 1900), or since 1904-01-01 in a
 * workbook using the 1904 date system.
 */
const dateOfSerial = (serial: number, date1904: boolean): string =>
  Temporal.PlainDate.from(date1904 ? "1904-01-01" : "1899-12-30")
    .add({ days: Math.floor(serial) })
    .toString()

const isCell = (value: unknown): value is XLSX.CellObject =>
  typeof value === "object" && value !== null && "t" in value

/**
 * One SheetJS cell as the core expects it (ADR 0005): `null` when empty,
 * text unchanged, a number as its shortest exact decimal string, a
 * date-formatted number as its ISO calendar date.
 */
const toCell = (cell: unknown, date1904: boolean): Cell => {
  if (!isCell(cell)) return null
  const { t: type, v: value, z: format } = cell
  if (type === "s" && typeof value === "string") return value
  if (type === "n" && typeof value === "number") {
    return typeof format === "string" && isDateFormat(format)
      ? dateOfSerial(value, date1904)
      : String(value)
  }
  if (type === "b" && typeof value === "boolean") return String(value)
  if (type === "d" && value instanceof Date) return value.toISOString().slice(0, 10)
  return null
}

const unreadable = () => new InvalidImport({ problems: [{ problem: "unreadable_file" }] })

/**
 * Decodes an Excel workbook (`.xls` or `.xlsx`) into the grid of its first
 * sheet: every row of the used range, each as wide as the range. Fails with
 * `unreadable_file` when the bytes aren't a workbook SheetJS can read.
 */
export const decodeSpreadsheet = (bytes: Uint8Array): Effect.Effect<Grid, InvalidImport> =>
  Effect.try({
    try: () => XLSX.read(bytes, { type: "array", cellDates: false, cellNF: true, dense: false }),
    catch: unreadable,
  }).pipe(
    Effect.flatMap((book) => {
      const [sheetName] = book.SheetNames
      const sheet = sheetName === undefined ? undefined : book.Sheets[sheetName]
      if (sheetName === undefined || sheet === undefined) return Effect.fail(unreadable())
      const ref = sheet["!ref"]
      if (ref === undefined) return Effect.succeed({ sheetName, rows: [] })

      const date1904 = book.Workbook?.WBProps?.date1904 === true
      const range = XLSX.utils.decode_range(ref)
      const rows: Cell[][] = []
      for (let r = range.s.r; r <= range.e.r; r += 1) {
        const row: Cell[] = []
        for (let c = range.s.c; c <= range.e.c; c += 1) {
          const cell: unknown = sheet[XLSX.utils.encode_cell({ r, c })]
          row.push(toCell(cell, date1904))
        }
        rows.push(row)
      }
      return Effect.succeed({ sheetName, rows })
    }),
  )
