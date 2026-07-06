# Repository Scripts

`scripts/` contains repository automation that should be useful both locally and
in CI. Keep scripts small, explicit, and tied to a concrete workflow.

## Conventions

- Run scripts from any working directory; each script moves to the repository
  root before doing work.
- Use Bash with `set -euo pipefail`.
- Do not put secrets, local credentials, or machine-specific paths in scripts.
- Prefer scripts for multi-step repository workflows that need CI/local parity.
  Prefer `package.json` scripts for short Bun workspace commands.

## CI Scripts

`scripts/ci/` mirrors the jobs in `.github/workflows/ci.yml`:

- `frontend.sh`: Bun workspace typecheck, lint, tests, and web build.
- `backend.sh`: Rust fmt/check/clippy/tests, SQLx migration smoke, and OpenAPI
  export.
- `desktop.sh`: Tauri shell compile and capability checks.
- `contract.sh`: OpenAPI and generated TypeScript drift check.
- `docs.sh`: MkDocs build through uv and published-site exclusion checks.
- `container.sh`: API Docker image build.

The CI workflow stays in one `ci.yml` while these jobs share the same triggers
and permissions. Split workflows later when a job needs a different trigger,
permission model, cache strategy, or release/deploy lifecycle.

## Build Scripts

- `build.sh`: Builds the TypeScript workspace, builds the Rust workspace, and
  checks the Tauri shell. Use `bun run build:all` from the repository root.
