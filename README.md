# Campus Agora

Last updated: 2026-09-23

Campus Agora is being replanned as an opportunity discovery and actionable
guidance tool for individual student use, covering research groups, research opportunities,
internships and competitions across institutions and disciplines.

The initial product is a personal tool. Community features are only a possible
future extension, not part of the current scope or a scheduled phase.

Current stage: P1 needs and information-supply validation. See the
[product baseline](docs/product/overview.md) and [roadmap](docs/product/milestones.md).
The former community roadmap has been retired. Existing code remains an
engineering baseline to evaluate for reuse; the new product is not implemented.

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
bun run docker:api
```

Shared automation lives in `scripts/`. The CI workflow calls the same scripts so
local failures can be reproduced without copying commands from YAML.

The M0.1 API exposes:

- `GET /healthz`
- `GET /readyz`
- `GET /api/v1/meta`
