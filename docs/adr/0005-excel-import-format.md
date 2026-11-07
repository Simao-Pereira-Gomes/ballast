---
status: accepted
---

# Import Santander Excel exports, not PDF

Santander Portugal offers movement exports as PDF and Excel. v1 imports only the Excel export (`.xls`/`.xlsx`), because a PDF is text placed at coordinates. Rebuilding rows and columns from it (wrapped descriptions, page headers, carried-forward lines, possibly no text layer at all) is fragile, whereas Excel already has rows and columns. Decoding the file format is I/O-bound and needs a library, so it lives in the shell. The shell turns the file into a plain grid of cells, passing numbers as their exact decimal strings and dates as ISO strings. The pure Santander adapter in the core interprets that grid into statement lines plus Balance Checkpoints. Floating point never touches an amount, and tests use synthetic JSON grids, so no real bank file enters the repository.

## Consequences

- PDF import is out of scope for v1. If it is added later, it is a new decoder in the shell (positioned text) feeding another adapter; Ledger Ingest and everything after it is unchanged.
- Other banks' Excel or CSV exports reuse the same grid decoder and need only a new core adapter.
- An export's headers and fixed texts are in whatever language the bank's site was set to. Each adapter recognises its layout by structure (column shapes and lines, plus Santander's running balance chain), never by header text or the interface language, so a language it hasn't seen still works (ADR 0006). When no adapter recognises a file, the rejection names the headers it found.
- The decoder is SheetJS, the only maintained library that reads Santander's BIFF8 `.xls`. It is installed from the SheetJS CDN tarball, because the npm registry's `xlsx` package is frozen at a release with known advisories, and it is used only inside the shell's `decodeSpreadsheet`.
