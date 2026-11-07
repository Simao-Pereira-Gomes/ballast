import { Result } from "effect"
import { assert, describe, expect, it } from "vitest"
import {
  Money,
  fingerprintLines,
  normaliseDescription,
  parseStatement,
  statementTotals,
} from "../src/index.ts"
import type { Cell, Grid, StatementLine } from "../src/index.ts"
import english from "./fixtures/santander/movements-en.json" with { type: "json" }
import portuguese from "./fixtures/santander/movements-pt.json" with { type: "json" }

/** The fixture's first statement line is at index 7: spreadsheet row 8. */
const firstLine = 7

const parsed = (grid: Grid) => {
  const result = parseStatement(grid)
  assert(Result.isSuccess(result), JSON.stringify(Result.isFailure(result) && result.failure))
  return result.success
}

const problemsOf = (grid: Grid) => {
  const result = parseStatement(grid)
  assert(Result.isFailure(result), "expected the statement to be rejected")
  return result.failure.problems
}

/** The Portuguese fixture with some rows replaced, by their index in the grid. */
const withRows = (replacements: Record<number, readonly Cell[]>): Grid => ({
  ...portuguese,
  rows: portuguese.rows.map((row, index) => replacements[index] ?? row),
})

/** The Portuguese fixture with one cell of one row replaced. */
const withCell = (index: number, column: number, value: Cell): Grid => {
  const row = [...(portuguese.rows[index] ?? [])]
  row[column] = value
  return withRows({ [index]: row })
}

const summary = (line: StatementLine) => ({
  date: line.date.toString(),
  cents: line.amount.cents,
  description: line.description,
})

describe("parseStatement on a Santander export", () => {
  it("reads every statement line, oldest first, from the Portuguese layout", () => {
    const statement = parsed(portuguese)

    expect(statement.format).toBe("santander")
    expect(statement.lines).toHaveLength(19)
    expect(summary(statement.lines[0])).toEqual({
      date: "2026-09-01",
      cents: -2347n,
      description: "Compra Supermercado Exemplo",
    })
    const newest = statement.lines.at(-1)
    assert(newest !== undefined)
    expect(summary(newest)).toEqual({
      date: "2026-09-30",
      cents: 3n,
      description: "Juros Credores",
    })
  })

  it("reads the same lines from the English layout", () => {
    expect(parsed(english).lines.map(summary)).toEqual(parsed(portuguese).lines.map(summary))
  })

  it("recognises the layout by its structure, whatever language the headers are in", () => {
    const spanish = withRows({
      6: ["Fecha operación", "Fecha valor", "Concepto", "Importe( EUR )", "Saldo( EUR )"],
    })
    expect(parsed(spanish).lines).toHaveLength(19)
  })

  it("reads signed amounts with zero, one or two decimals as exact cents", () => {
    const amounts = parsed(portuguese).lines.map((line) => line.amount)
    // "-0.12", "0.03", "-1.2", "-48.9", "1850" and "-55.01" in the file
    for (const cents of [-12n, 3n, -120n, -4890n, 185000n, -5501n]) {
      expect(amounts).toContainEqual(Money.eur(cents))
    }
  })

  it("keeps two identical lines on the same day as two statement lines", () => {
    const bakery = parsed(portuguese).lines.filter(
      (line) => line.description === "Compra Padaria Central",
    )
    expect(bakery.map(summary)).toEqual([
      { date: "2026-09-08", cents: -120n, description: "Compra Padaria Central" },
      { date: "2026-09-08", cents: -120n, description: "Compra Padaria Central" },
    ])
  })

  it("dates each line by its operation date, not its value date", () => {
    const lines = parsed(portuguese).lines
    const debit = lines.find((line) => line.description.startsWith("Débito Directo"))
    const cheque = lines.find((line) => line.description.startsWith("Depósito de Cheque"))
    expect(debit?.date.toString()).toBe("2026-09-10")
    expect(cheque?.date.toString()).toBe("2026-09-18")
  })

  it("keeps the description as the bank wrote it, beside its normalised key", () => {
    const salary = parsed(portuguese).lines.find((line) => line.amount.cents === 185000n)
    expect(salary?.description).toBe("Transferência de Ordenado Empresa Exemplo Lda")
    expect(salary?.descriptionKey).toBe(
      normaliseDescription("Transferência de Ordenado Empresa Exemplo Lda"),
    )
  })

  it("gives each line its spreadsheet row number", () => {
    const lines = parsed(portuguese).lines
    expect(lines.at(-1)?.row).toBe(firstLine + 1)
    expect(lines[0].row).toBe(firstLine + 19)
  })

  it("states the Balance Checkpoint after the newest line", () => {
    const { balanceCheckpoint } = parsed(portuguese)
    expect(balanceCheckpoint.balance).toEqual(Money.eur(100400n))
    expect(balanceCheckpoint.date.toString()).toBe("2026-09-30")
  })

  it("totals the money in and out of the lines", () => {
    // In: 1850 + 40 + 19.99 + 120 + 0.03. Out: the rest, from the 412.35 opening balance.
    expect(statementTotals(parsed(portuguese).lines)).toEqual({
      moneyIn: Money.eur(203002n),
      moneyOut: Money.eur(-143837n),
    })
  })

  it("skips empty rows among the lines", () => {
    const rows = [...portuguese.rows]
    rows.splice(firstLine + 3, 0, [null, null, null, null, null])
    expect(parsed({ ...portuguese, rows }).lines).toHaveLength(19)
  })

  it("still recognises the layout when the first line is malformed", () => {
    expect(problemsOf(withCell(firstLine, 3, "abc"))).toEqual([
      { row: firstLine + 1, problem: "invalid_amount" },
    ])
  })
})

describe("parseStatement rejects a file it can't trust", () => {
  it("names the headers it found when it doesn't recognise the layout", () => {
    const other: Grid = {
      sheetName: "Export",
      rows: [
        ["Date", "Details", "Debit", "Credit"],
        ["2026-09-01", "Coffee", "1.20", null],
      ],
    }
    expect(problemsOf(other)).toEqual([
      { problem: "unrecognised_layout", headers: ["Date", "Details", "Debit", "Credit"] },
    ])
  })

  it("names the widest row as the headers, not a title above it", () => {
    const other: Grid = {
      sheetName: "Export",
      rows: [
        ["Extracto", "Conta 1"],
        ["Date", "Details", "Debit", "Credit"],
        ["2026-09-01", "Coffee", "1.20", null],
      ],
    }
    expect(problemsOf(other)).toEqual([
      { problem: "unrecognised_layout", headers: ["Date", "Details", "Debit", "Credit"] },
    ])
  })

  it("rejects an empty sheet as unrecognised", () => {
    expect(problemsOf({ sheetName: "Sheet1", rows: [] })).toEqual([
      { problem: "unrecognised_layout", headers: [] },
    ])
  })

  it("rejects an export with no statement lines", () => {
    const empty: Grid = { ...portuguese, rows: [...portuguese.rows.slice(0, firstLine), [null]] }
    expect(problemsOf(empty)).toEqual([{ problem: "no_lines" }])
  })

  it.each([
    ["31-02-2026", 0],
    ["2026-09-30", 0],
    ["30/09/2026", 0],
    ["31-09-2026", 1],
  ])("rejects the date %j", (date, column) => {
    expect(problemsOf(withCell(firstLine, column, date))).toEqual([
      { row: firstLine + 1, problem: "invalid_date" },
    ])
  })

  it.each(["1.234", "1e3", "0,03", "abc", "+0.03"])("rejects the amount %j", (amount) => {
    expect(problemsOf(withCell(firstLine, 3, amount))).toContainEqual({
      row: firstLine + 1,
      problem: "invalid_amount",
    })
  })

  it("rejects a balance that isn't a decimal amount", () => {
    expect(problemsOf(withCell(firstLine, 4, "1.004,00"))).toContainEqual({
      row: firstLine + 1,
      problem: "invalid_amount",
    })
  })

  it("rejects a zero amount", () => {
    expect(problemsOf(withCell(firstLine, 3, "0"))).toContainEqual({
      row: firstLine + 1,
      problem: "zero_amount",
    })
  })

  it.each([null, "   "])("rejects a line whose description is %j", (description) => {
    expect(problemsOf(withCell(firstLine, 2, description))).toEqual([
      { row: firstLine + 1, problem: "missing_description" },
    ])
  })

  it("rejects a description longer than a Transaction can hold", () => {
    expect(problemsOf(withCell(firstLine, 2, "x".repeat(201)))).toEqual([
      { row: firstLine + 1, problem: "description_too_long" },
    ])
  })

  it("rejects a line with an empty cell", () => {
    expect(problemsOf(withCell(firstLine, 4, null))).toEqual([
      { row: firstLine + 1, problem: "incomplete_line" },
    ])
  })

  it("rejects a line whose amount breaks the running balance", () => {
    // Row 10 is "Reembolso Loja Exemplo", 19.99 with balance 1518.97.
    expect(problemsOf(withCell(firstLine + 3, 3, "19.98"))).toEqual([
      { row: firstLine + 4, problem: "balance_mismatch" },
    ])
  })

  it("rejects a missing line, which breaks the running balance", () => {
    const rows = portuguese.rows.filter((_, index) => index !== firstLine + 5)
    expect(problemsOf({ ...portuguese, rows })).toEqual([
      { row: firstLine + 5, problem: "balance_mismatch" },
    ])
  })

  it("reports every problem in the file, not just the first", () => {
    const grid = withRows({
      [firstLine]: ["30-09-2026", "30-09-2026", "Juros Credores", "0.03x", "1004"],
      [firstLine + 2]: ["25-13-2026", "25-09-2026", "Trf. MB WAY", "-15", "1503.97"],
    })
    expect(problemsOf(grid)).toEqual([
      { row: firstLine + 1, problem: "invalid_amount" },
      { row: firstLine + 3, problem: "invalid_date" },
    ])
  })
})

describe("fingerprintLines", () => {
  const lines = parsed(portuguese).lines

  it("gives every line in a file a distinct fingerprint, even identical lines", () => {
    const fingerprints = fingerprintLines(lines)
    expect(fingerprints).toHaveLength(lines.length)
    expect(new Set(fingerprints).size).toBe(lines.length)
  })

  it("is the same for the same lines every time", () => {
    expect(fingerprintLines(parsed(english).lines)).toEqual(fingerprintLines(lines))
  })

  it("ignores differences the normalised description ignores", () => {
    const shouted = lines.map((line) => {
      const description = `  ${line.description.toUpperCase()} `
      return { ...line, description, descriptionKey: normaliseDescription(description) }
    })
    expect(fingerprintLines(shouted)).toEqual(fingerprintLines(lines))
  })

  it("tells identical lines apart by their order within the day", () => {
    const bakery = lines.filter((line) => line.description === "Compra Padaria Central")
    const [first, second] = fingerprintLines(bakery)
    expect(first).not.toBe(second)
    expect(fingerprintLines(bakery.slice(0, 1))).toEqual([first])
  })
})
