# Campus Agora

Campus Agora is a campus discussion and knowledge archive platform. This repository is currently in the M0.1 Contract And Quality Gates stage.

## Requirements

- Bun
- Rust stable with `rustfmt` and `clippy`
- PostgreSQL 16 for migration and readiness checks
- uv for MkDocs documentation builds

## Core Commands

```bash
bun install
bun run dev:web
cargo run -p campus_agora_api
bun run api:types
bun run typecheck
bun run lint
bun run lint:styles
bun run test
bun run build
bun run build:all
cargo check --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

CI-parity scripts:

```bash
bun run ci:frontend
bun run ci:backend
bun run ci:desktop
bun run ci:contract
bun run ci:docs
bun run ci:container
```

Service and release checks:

```bash
cargo sqlx migrate run --source crates/db/migrations
bun run docs:build
docker build -f Dockerfile.api .
```

Shared automation lives in `scripts/`. The CI workflow calls the same scripts so
local failures can be reproduced without copying commands from YAML.

The M0.1 API exposes:

- `GET /healthz`
- `GET /readyz`
- `GET /api/v1/meta`
