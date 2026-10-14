# Campus Agora

Last updated: 2026-10-14

Campus Agora is being replanned as an opportunity discovery and actionable
guidance tool for individual student use, covering research groups, research opportunities,
internships and competitions across institutions and disciplines.

The initial product is a personal tool. Community features are only a possible
future extension, not part of the current scope or a scheduled phase.

Current stage: P1 needs and information-supply validation. See the
[product baseline](docs/product/overview.md) and [roadmap](docs/product/milestones.md).
The former community roadmap has been retired. The Web now has a Primer-based
prototype with fixed public samples, browser-local exploration topics, and a
local discovery API; real-provider execution remains pending credentials and
verification. Existing services remain an engineering baseline to evaluate for reuse.

## Requirements

- Bun
- Rust stable with `rustfmt` and `clippy`
- PostgreSQL 16 for migration and readiness checks
- uv for MkDocs documentation builds

## Web Preview and Portable HTML

Run `bun run dev:web` for development. The top-right button switches between
Primer light and dark and remembers the choice in this browser.

Run `bun --cwd apps/web build`, then open `apps/web/dist/index.html` in a browser.
The export contains its script, theme styles, logo and favicon in one file and
can be copied or renamed independently. Double-clicking the source
`apps/web/index.html` redirects to that built file while preserving its hash route;
build again after source changes to refresh the exported version.

`bun --cwd apps/web preview` serves the same export at
`http://127.0.0.1:4180/`. Local browsing, comparison and saved topics work without
the discovery service; external lookup requires the local discovery API and
an HTTP proxy to `/api/discovery`. A standalone file does not start that service.

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
