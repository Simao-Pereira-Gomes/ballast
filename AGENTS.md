# Agent Instructions

## Git

- **No co-author trailers.** Do not add `Co-Authored-By:` (or any other attribution trailer) to commit messages unless the repository owner explicitly asks for it in that request.
- **Semantic commit messages ([Conventional Commits](https://www.conventionalcommits.org/)).** Write the subject as `<type>(<scope>): <summary>`, with the scope optional. The summary is imperative, lower case, has no trailing full stop and stays under about 72 characters, e.g. `feat(core): parse Santander statement lines`.
  - **Types:** `feat` (behaviour the Owner can see), `fix` (a bug), `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`.
  - **Scopes:** `core`, `web`, `db` or `deps`, or leave the scope out when the change spans several.
  - **Breaking changes:** mark them with `!` after the type or scope, plus a `BREAKING CHANGE:` footer.
  - **PR titles too:** PRs are squash-merged, so the PR title becomes the commit on `main` and must follow the same format.
- **One short-lived branch per ticket, merged into `main` by PR.** Branch from an up-to-date `main` and name the branch `<issue-number>-<slug>` (e.g. `2-walking-skeleton`). Open a PR whose description says `Closes #<n>`, merge once CI passes, then delete the branch. Never commit directly to `main`, and don't create long-lived release branches: `main` must always work. Release points are tags (e.g. `v1.0.0`) and GitHub milestones.

## GitHub

- **No AI attribution footers.** Do not add "Generated with Claude Code" or similar attribution lines to pull request descriptions, issues or comments unless the repository owner explicitly asks for it in that request.

## Domain

- Use the vocabulary in [`CONTEXT.md`](./CONTEXT.md) in code, docs and issues, and respect the decisions in [`docs/adr/`](./docs/adr).

## Code rules

Stack and rationale: ADRs 0003–0005.

- **Routes only call application services.** Loaders and server functions call one service through `runtime.runPromise` (via the shared helper) and contain no SQL, domain logic or direct core calls. oxlint enforces this: files in `apps/web/src/routes/` may import server code only from `src/server/functions/`.
- **The core stays pure.** `packages/core` performs no I/O and depends on nothing except `effect`. It may use only Effect's pure modules (`Result`, `Option`, `Data`, `Brand`, `Match`, `Schema`, `SchemaIssue`, `Order`, `Equivalence`) and never `Effect`, `Layer` or `Context`.
- **Effect 4 only.** Use `Result`, not `Either`. Import Schema from `effect` (`effect/Schema`), never `@effect/schema`. A `Result` can't be `yield*`-ed in `Effect.gen`; lift it with `Effect.fromResult`. Check the installed `.d.ts` files rather than relying on memory of v3 APIs.
- **Expected failures are typed errors; bugs throw.** A Balance Discrepancy or an uncertain classification is normal output, not an error.
- **Money is integer cents through `Money`.** No floating point on amounts, no `toFixed`, no display formatting outside the core `Money` formatter. Postgres stores amounts as `bigint`.
- **Interface text only through messages.** Every user-facing string lives in `apps/web/messages/{en,pt-PT}.json` (Paraglide, ADR 0006), using the pt-PT terms from `CONTEXT.md`. The core returns codes and parameters, never sentences; `Money.format` and `formatDate` take a `Locale`.
- **Calendar dates are `Temporal.PlainDate`.** No `Date` in domain code; `Date`/`Instant` only for technical timestamps such as `created_at`.
- **Everything is Owner-scoped.** Every persistence function takes an `OwnerId`, and every table has `owner_id` with composite `(owner_id, …)` foreign keys.
- **Migrations are handwritten SQL**, committed and reviewed, run by Effect's `Migrator`.
- **No real bank data in the repository.** Test fixtures are synthetic.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for `Simao-Pereira-Gomes/ballast`, managed through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, except `ready-for-human`, which maps to the existing `hitl` label. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
