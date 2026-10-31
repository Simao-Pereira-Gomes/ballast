---
status: accepted
---

# Server web app with Postgres, not local-first

We build a TypeScript server web app backed by PostgreSQL, run locally in Docker for now, rather than a local-first client with CRDT sync (the Actual Budget model) or a desktop/SQLite app. The app is import-driven and analysis-heavy (Forecast, Rule Set, Allocation Waterfall) rather than built around frequent offline data entry, so local-first's main benefit is small. Meanwhile, its costs (CRDT sync complexity, awkward multi-Owner support, server features like scheduled Forecasts and future Open Banking sync needing a server anyway) are high. The apps closest in scope, Sure (Maybe Finance fork) and Ghostfolio, made the same choice.

## Consequences

- Owner scoping is part of the schema from day one; going multi-Owner later means adding authentication and a hosted deployment, not changing the storage model.
- Privacy today comes from running on the Owner's own machine, not from the architecture; exposing it beyond localhost requires HTTPS and authentication first.
