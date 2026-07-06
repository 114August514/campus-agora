# Agent Notes

Last updated: 2026-07-06

This file is the project-level instruction sheet for AI agents and human
collaborators. Follow it before making changes.

## Project Context

Follow the repository spec in
`docs/superpowers/specs/2026-07-06-campus-agora-init-design.md`.

Current implementation scope:

- M0 is a runnable repository skeleton.
- M0.1 adds contract and quality gates.
- M0.2 adds governance docs and risk boundaries.

## Collaboration Rules

- Read the relevant local context before editing: this file, the active spec,
  related docs, package scripts, and nearby source files.
- Before changing a product, frontend, backend, API, operations, desktop, or
  monorepo boundary, read `docs/constraints/index.md` and the area-specific
  constraint reference listed there.
- If a constraint reference becomes an accepted project rule, promote it into
  the matching formal doc or milestone in the same change.
- Keep changes scoped to the active task and milestone. Do not expand runtime
  behavior, dependencies, or documentation structure unless the task requires it.
- Prefer existing workspace conventions over new abstractions.
- Before editing files, state what will change and why.
- Verify changes with the narrowest meaningful command set, and report commands
  that were run or could not be run.
- Do not claim work is complete without fresh verification evidence.

## AI Log Workflow

Use `docs/ai-log/` for low-friction task memory. It complements issues,
milestones, commit history, and PRs; it does not replace them.

For non-trivial agent work:

1. Add or update an entry in `docs/ai-log/todo.md` when a task starts, when a
   blocker is found, or when a follow-up becomes clear.
2. Move completed task facts into `docs/ai-log/done.md` before final handoff.
3. Keep entries short, dated, and tied to concrete files, commits, commands, or
   follow-up decisions.

`todo.md` should record what needs to happen:

- task title and source
- priority or milestone
- acceptance criteria
- dependencies or blockers
- owner/status when useful

`done.md` should record what actually happened:

- completed work
- changed files or commits
- verification commands
- important decisions and tradeoffs
- follow-up tasks that remain

Do not log every terminal command. Do not write secrets, tokens, credentials,
real student identity data, private callback URLs, database dumps, or raw
unredacted logs into AI LOG files.

## Documentation Freshness

Docs can become stale and affect implementation judgment. Treat code, scripts,
contracts, lockfiles, and current CI as the freshest source for executable
behavior.

For durable docs that guide decisions, add or update a `Last updated:
YYYY-MM-DD` line near the top when creating the file or making a material
change. This applies to formal docs under `docs/`, reference docs under
`docs/constraints/`, tool docs such as `tools/README.md`, and this file.

Do not change the date for typo-only edits. If an existing doc has no freshness
line and the task depends on it, verify the claim against local source files
before relying on it, then add the freshness line if the doc is updated.

When a documented command, path, config location, API contract, milestone, or
security boundary changes, update the relevant doc in the same PR and record the
verification command in AI LOG when the work is non-trivial.

## Local Reference Files

Durable reference notes belong under `docs/constraints/`, not in the repository
root. Do not create new root-level scratch files such as `ref*.md`, `temp*.md`,
`api.md`, `backend.md`, `frontend.md`, or `monorepo.md` unless the user
explicitly requests a short-lived local note.

When a root-level reference note is useful for collaboration, rename it into
`docs/constraints/`, add it to `docs/constraints/index.md`, and update MkDocs
navigation if it should be published.
