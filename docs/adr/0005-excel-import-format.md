---
status: accepted
---

# Import Santander Excel exports, not PDF

Santander Portugal offers movement exports as PDF and Excel. v1 imports only the Excel export (`.xls`/`.xlsx`), because a PDF is text placed at coordinates. Rebuilding rows and columns from it (wrapped descriptions, page headers, carried-forward lines, possibly no text layer at all) is fragile, whereas Excel already has rows and columns. Decoding the file format is I/O-bound and needs a library, so it lives in the shell. The shell turns the file into a plain grid of cells, passing numbers as their exact decimal strings and dates as ISO strings. The pure Santander adapter in the core interprets that grid into statement lines plus Balance Checkpoints. Floating point never touches an amount, and tests use synthetic JSON grids, so no real bank file enters the repository.

## Consequences

- PDF import is out of scope for v1. If it is added later, it is a new decoder in the shell (positioned text) feeding another adapter; Ledger Ingest and everything after it is unchanged.
- Other banks' Excel or CSV exports reuse the same grid decoder and need only a new core adapter.
- An export's headers and fixed texts are in whatever language the bank's site was set to. Each adapter recognises its layout from the header row in every language it supports and reads values by layout, never by the interface language (ADR 0006).
