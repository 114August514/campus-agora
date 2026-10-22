# Campus Lumen

Last updated: 2026-10-22

帮大学生跨机构发现科研、实习、竞赛、交流等机会，看懂实际任务与条件，自主决定下一步。

Campus Lumen（原 Campus Agora）是个人使用的机会探索与决策支持工具，初期服务科大学生。
社区仅是可能的未来扩展，不属于当前范围或预定阶段。

当前处于 P2 任务设计与有限实现试验，首个完整交付场景为选导师指南 demo。
具体范围、已实现能力和未完成项见[产品概览](docs/product/overview.md)及[里程碑](docs/product/milestones.md)。

Repository: [114August514/campus-lumen](https://github.com/114August514/campus-lumen).

## Repository Layout

For the file tree and placement rules, see the
[repository layout](docs/engineering/repository-layout.md).
Use `work/` for local drafts, investigation notes and experiment outputs;
only its [placement guide](work/README.md) is intended for version control.
Keep short handoff summaries in `docs/ai-log/` and accepted decisions in the
relevant formal documentation.

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
