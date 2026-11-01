# Santander Portugal fixtures

Synthetic grids with the same structure as Santander Portugal's Excel movements export
(the mapping is documented on issue #3). All the data is invented: no real bank data
goes into the repository.

Each fixture is the grid the shell hands to the core adapter after decoding the file
(ADR 0005):

- `sheetName`: the worksheet's name.
- `rows`: every row in the sheet's used range, top to bottom, each as wide as the range.
  An empty cell is `null`. A text cell is its text, unchanged. A numeric cell is the
  shortest exact decimal string of its value, as JavaScript prints it (`"-48.9"`,
  `"1850"`, `"0.03"`). It never has thousands separators or padded decimals.

## `movements-pt.json`

An export from the site in Portuguese, 1–30 September 2026, newest first:

- Rows 0–5: an export-date line, the Owner's name, `Saldos e movimentos` and
  `Listagem de Movimentos`, with empty rows between them.
- Row 6: headers `Data Operação | Data valor | Descrição | Montante( EUR ) | Saldo Contabilístico( EUR )`.
- Then one row per movement: both dates are text `DD-MM-YYYY`, the amount is signed and the
  running balance (`Saldo Contabilístico`) is the balance after that movement.
- A trailing empty row, because the real export's used range includes one.

The running balance chains exactly: each row's balance is the next (older) row's balance
plus this row's amount, and the opening balance is 412.35.

Edge cases it covers, all seen in the real export:

- Two identical lines (`Compra Padaria Central`, -1.2, 08-09-2026). Only the running
  balance tells them apart.
- A value date before the operation date (`Débito Directo Seguro Exemplo`) and one after it
  (`Depósito de Cheque 00012345`).
- An overdraft: the balance goes negative, and a credit arrives while it is negative.
- Several movements on one day.
- Amounts with zero, one or two decimals, and sub-euro amounts (`-0.12`, `0.03`).
- Title Case descriptions with accents (`ç`, `ã`, `é`) and tokens with digits.
