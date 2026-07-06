# Tools

Last updated: 2026-07-06

This directory stores tool-specific configuration that does not need to live in
the repository root for automatic discovery.

Root-level commands remain the public interface for contributors and CI. Prefer
calling tools through `package.json` scripts or `scripts/ci/*.sh` instead of
running nested tool commands directly.

## Layout

- `docs/`: MkDocs and uv configuration for the documentation site.

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
