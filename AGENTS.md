# Agent Instructions

## Git

- **No co-author trailers.** Do not add `Co-Authored-By:` (or any other attribution trailer) to commit messages unless the repository owner explicitly asks for it in that request.

## GitHub

- **No AI attribution footers.** Do not add "Generated with Claude Code" or similar attribution lines to pull request descriptions, issues or comments unless the repository owner explicitly asks for it in that request.

## Domain

- Use the vocabulary in [`CONTEXT.md`](./CONTEXT.md) in code, docs and issues, and respect the decisions in [`docs/adr/`](./docs/adr).

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for `Simao-Pereira-Gomes/ballast`, managed through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, except `ready-for-human`, which maps to the existing `hitl` label. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
