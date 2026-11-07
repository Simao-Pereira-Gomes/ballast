import { Effect, Exit } from "effect"
import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { decodeSpreadsheet } from "./spreadsheet.ts"

/** A workbook built in memory from invented cells, written in `bookType`. */
const workbook = (bookType: "biff8" | "xlsx", rows: unknown[][], sheetName = "Movimentos") => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheetName)
  const bytes: unknown = XLSX.write(book, { bookType, type: "array" })
  if (!(bytes instanceof ArrayBuffer)) throw new Error("SheetJS wrote no ArrayBuffer")
  return new Uint8Array(bytes)
}

const rows = [
  ["Listagem de Movimentos", null, null],
  [null, null, null],
  ["Data Operação", "Descrição", "Montante( EUR )"],
  ["30-09-2026", "Juros Credores", 0.03],
  ["29-09-2026", "Compra Padaria Central", -1.2],
  ["28-09-2026", "Transferência de Ordenado", 1850],
  ["27-09-2026", "Pagamento", -48.9],
]

describe("decodeSpreadsheet", () => {
  it.each(["biff8", "xlsx"] as const)(
    "turns a %s workbook's first sheet into a grid of text cells",
    async (bookType) => {
      const grid = await Effect.runPromise(decodeSpreadsheet(workbook(bookType, rows)))

      expect(grid).toEqual({
        sheetName: "Movimentos",
        rows: [
          ["Listagem de Movimentos", null, null],
          [null, null, null],
          ["Data Operação", "Descrição", "Montante( EUR )"],
          ["30-09-2026", "Juros Credores", "0.03"],
          ["29-09-2026", "Compra Padaria Central", "-1.2"],
          ["28-09-2026", "Transferência de Ordenado", "1850"],
          ["27-09-2026", "Pagamento", "-48.9"],
        ],
      })
    },
  )

  it("passes a date cell as its ISO calendar date", async () => {
    const dateCell = { t: "n", v: 46295, z: "dd-mm-yyyy" }
    const grid = await Effect.runPromise(
      decodeSpreadsheet(
        workbook("xlsx", [
          ["Data", "Montante"],
          [dateCell, 46295],
        ]),
      ),
    )

    expect(grid.rows).toEqual([
      ["Data", "Montante"],
      ["2026-09-30", "46295"],
    ])
  })

  it("decodes an empty workbook sheet as no rows", async () => {
    const grid = await Effect.runPromise(decodeSpreadsheet(workbook("xlsx", [])))
    expect(grid.rows).toEqual([])
  })

  it("fails as unreadable on bytes that aren't a workbook", async () => {
    const zipWithNoWorkbook = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
    const exit = await Effect.runPromiseExit(decodeSpreadsheet(zipWithNoWorkbook))
    expect(Exit.isFailure(exit)).toBe(true)
    expect(JSON.stringify(exit)).toContain("unreadable_file")
  })
})
