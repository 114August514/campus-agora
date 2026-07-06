# Quality Gates

M0.1 turns the repository skeleton into a checked engineering loop.

## Required Local Checks

```bash
bun run build:all
bun run ci:frontend
bun run ci:desktop
bun run ci:contract
bun run ci:docs
```

## Service Checks

```bash
bun run ci:backend
bun run ci:container
```

The service checks require local PostgreSQL and Docker. MkDocs dependencies are
managed by uv through `pyproject.toml` and `uv.lock`.

## Script Boundary

Shared multi-step workflows live in `scripts/`. The scripts mirror CI jobs and
can be run through `bun run ci:*` shortcuts from the repository root.

Keep `.github/workflows/ci.yml` as one workflow while all jobs share pull
request and `main` push triggers. Split workflows when a job needs a different
trigger, permission boundary, deploy target, or scheduled cadence.

## Contract Drift

Run `bun run api:check` before merging API changes. It regenerates OpenAPI and
TypeScript types, then fails if the committed generated files are stale.
