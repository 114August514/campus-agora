# Development

## Requirements

- Bun `1.3.14`
- Rust stable with `rustfmt` and `clippy`
- PostgreSQL 16 for migration smoke tests
- uv for MkDocs

## Local API

```bash
cp .env.example .env
cargo run -p campus_agora_api
```

The API exposes:

- `GET /healthz`
- `GET /readyz`
- `GET /api/v1/meta`

`/readyz` checks PostgreSQL when `DATABASE_URL` is configured.

## API Client

```bash
bun run api:types
bun --cwd packages/api-client test
```

Pages and hooks should call the API through `@campus-agora/api-client`.
Use `createCampusAgoraMockFetch()` for local mock wiring and tests.

## Repository Scripts

Shared automation lives in `scripts/`. Use the root `bun run ci:*` commands to
run the same checks that CI runs for frontend, backend, desktop, contracts,
docs, and container builds. Use `bun run build:all` for a local all-target
build check.
