# Tools

Last updated: 2026-10-04

This directory stores tool-specific configuration that does not need to live in
the repository root for automatic discovery.

Root-level commands remain the public interface for contributors and CI. Prefer
calling tools through `package.json` scripts or `scripts/ci/*.sh` instead of
running nested tool commands directly.

## Layout

- `docs/`: MkDocs and uv configuration for the documentation site.
- `discovery/`: Offline collected-batch validation, invoked with `bun run discovery:validate <batch.json>`; it does not browse or publish.
- `skills/opportunity-discovery/`: Repository draft research skill and batch-format reference. Ask the agent to read its `SKILL.md` explicitly; it is not installed into an automatic skill-discovery directory.

## Rules

- Keep language workspace roots, lockfiles, Git config, editor config, and
  agent instructions in the repository root when tool discovery depends on that
  location.
- Put config here only when the tool can be invoked with an explicit path or
  through a wrapper script.
- Update `README.md`, `docs/engineering/quality.md`, and affected scripts when
  moving a tool config.
- Add or update a `Last updated: YYYY-MM-DD` line when this file changes
  materially.
