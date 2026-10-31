# Ballast

Personal finance tracker that answers one question: **how much of my money should stay in the bank as a safety reserve, and how much should I invest?**

Ballast imports bank exports, classifies Revenue and Expenses, forecasts the next 12 months, and applies a configurable Rule Set (Portuguese/EU guidance by default) through an Allocation Waterfall: Operating Cash → Starter Reserve → High-Interest Debt → Reserve Target → Investable Surplus.

> Ballast is the weight a ship carries so it can sail confidently. Whatever is beyond it is free to go to work.

## Status

Design phase. See the documentation below.

## Documentation

- [`CONTEXT.md`](./CONTEXT.md): domain glossary (the ubiquitous language used in code, docs and issues)
- [`docs/adr/`](./docs/adr): architecture decision records
- [`docs/prd/`](./docs/prd): product requirements

## Privacy

Ballast is designed to run on your own machine. **Never commit bank exports or personal financial data**: `.gitignore` excludes common export formats and the `data/` / `imports/` folders. Test fixtures must be synthetic.
