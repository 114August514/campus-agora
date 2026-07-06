# AI Log Done

This file records completed agent-visible work. Keep entries factual and link
them to commits, files, and verification commands where possible.

## Entry Format

```md
### YYYY-MM-DD - Task Title

- Result:
- Changed:
- Verification:
- Decisions:
- Follow-up:
```

## Completed

### 2026-07-06 - 收纳根目录工具配置

- Result: 将文档构建配置和 API 镜像 Dockerfile 从根目录移入工具目录，减少根目录配置文件数量。
- Changed: `tools/docs/*`, `docker/api/Dockerfile`, root scripts, README, engineering and deployment docs, active spec。
- Verification: `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run ci:docs`, `docker build --check -f docker/api/Dockerfile .`, `bash -n scripts/ci/docs.sh scripts/ci/container.sh`, `git diff --check` 和旧路径扫描。
- Decisions: 保留 `package.json`、`Cargo.toml`、lockfiles、Git 与编辑器配置在仓库根目录，保证工具默认发现路径稳定。
- Follow-up: 若继续收纳配置，优先只移动可显式传参的工具配置；不要破坏 Bun、Cargo、Git、编辑器默认发现路径。

### 2026-07-06 - 清理约束参考文档语气

- Result: 将约束参考、里程碑和 MkDocs 入口调整为中文项目参考语气，移除回答式措辞。
- Changed: `docs/constraints/*`, `docs/product/milestones.md`, `docs/index.md`, `mkdocs.yml`。
- Verification: `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run ci:docs`、`git diff --check` 和措辞扫描。
- Decisions: 保留参考文档与正式文档的分层；约束参考继续作为细节清单，已接受要求仍需提升到正式文档或里程碑。
- Follow-up: 后续补充 `docs/constraints/` 时继续使用项目参考语气，避免复制聊天回答格式。

### 2026-07-06 - Promote reference notes into docs constraints

- Result: Moved root-level local reference notes into publishable
  `docs/constraints/` files and expanded milestone tracking.
- Changed: Added constraint reference docs and reading map, updated MkDocs nav,
  expanded `docs/product/milestones.md`, updated `AGENTS.md` collaboration
  rules, and linked constraints from the docs index.
- Verification: `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run
  ci:docs`, `git diff --check`, and old project-name scan over AGENTS.md,
  docs, and MkDocs config.
- Decisions: Kept constraint references separate from formal architecture and
  product docs. Accepted rules should be promoted into formal docs and
  milestones when implemented.
- Follow-up: Keep future durable reference notes under `docs/constraints/`
  instead of the repository root.

### 2026-07-06 - Resolve M0 review findings after PR #2 merge

- Result: Addressed the post-rebase M0/M0.1/M0.2 review findings on PR #3.
- Changed: Flattened API `ErrorResponse`, regenerated OpenAPI and TypeScript
  contract types, updated API client error normalization, added CORS allowlist
  and request body limit middleware, expanded API tests, and corrected
  governance docs for roles and retention.
- Verification: `bun run api:types`, `cargo test -p campus_agora_api --test
  health`, `cargo test -p campus_agora_api --test openapi`,
  `bun --cwd packages/api-client test`, `cargo test -p campus_agora_api`,
  `cargo check --workspace --all-targets`, `cargo clippy --workspace
  --all-targets -- -D warnings`, `cargo test --workspace`, `bun run
  ci:frontend`, `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run
  ci:docs`, and `git diff --check`.
- Decisions: Kept the generated contract as the source of TypeScript response
  types, while the API client still accepts the old nested error shape for
  compatibility. Runtime CORS and body limit controls were implemented because
  the canonical spec already listed them in initialization scope.
- Follow-up: PR CI should still cover Docker/socket-backed checks that this
  sandbox cannot run directly.

### 2026-07-06 - Implement M0.2 governance docs and boundaries

- Result: Added formal M0.2 documentation for product scope, privacy,
  milestones, architecture, backend, auth/permissions, desktop, LFS, quality,
  operations, security, and deployment boundaries.
- Changed: `docs/product/*`, `docs/architecture/{overview,backend,auth-permissions,desktop}.md`,
  `docs/engineering/lfs.md`, expanded development/quality/deployment docs,
  updated `docs/index.md`, `mkdocs.yml`, README, AI LOG, and the M0.2 plan.
- Verification: `bun run ci:docs`, `test ! -d site/superpowers/specs`,
  `test ! -d site/superpowers/plans`, `git diff --check`, and placeholder
  scan over formal docs.
- Decisions: Kept M0.2 documentation-only; no runtime behavior, dependencies,
  APIs, database schema, or CI topology changed.
- Follow-up: After M0.1 merges, publish M0.2 as a follow-up PR or rebase this
  stacked branch onto `main`.

### 2026-07-06 - Rename automation folder to scripts

- Result: Renamed the repository automation directory to `scripts/`.
- Changed: Updated `package.json`, `.github/workflows/ci.yml`, README,
  engineering docs, active M0.1 plan/spec, and existing AI LOG references.
- Verification: stale singular-path scan, `test ! -d script`, `test -d
  scripts`, `bash -n scripts/build.sh scripts/ci/*.sh`, `bun run build:all`,
  `bun run ci:docs`, and `git diff --check`.
- Decisions: Kept the same script layout under the more conventional plural
  directory name.
- Follow-up: Use `scripts/` for future repository automation.

### 2026-07-06 - Add repository automation scripts

- Result: Added shared repository automation scripts for local builds and CI
  job parity.
- Changed: Added `scripts/README.md`, `scripts/build.sh`, `scripts/ci/*.sh`,
  `bun run ci:*`, and `bun run build:all`; updated CI jobs to call scripts;
  documented the workflow split policy in README, engineering docs, the active
  spec, and the M0.1 plan.
- Verification: `bash -n scripts/build.sh scripts/ci/*.sh`, `bun run
  ci:frontend`, `bun run ci:contract`, `bun run ci:desktop`, `bun run
  ci:docs`, `bun run build:all`,
  `DATABASE_URL=postgres://campus_agora:campus_agora@127.0.0.1:55435/campus_agora bun run ci:backend`,
  `bun run ci:container`, and `git diff --check`.
- Decisions: Kept CI in one `.github/workflows/ci.yml` because all jobs share
  the same pull request and `main` push triggers. Scripts now carry command
  reuse; workflow files should split later only for different triggers,
  permissions, deployment lifecycles, or schedules.
- Follow-up: Add new CI scripts only when a workflow gains a distinct local
  reproduction command.

### 2026-07-06 - Switch docs tooling to uv

- Result: Replaced the MkDocs `requirements-docs.txt` flow with uv project
  metadata.
- Changed: Added `pyproject.toml` and `uv.lock`, deleted
  `requirements-docs.txt`, updated `docs:build`, CI docs job, README, quality
  docs, development docs, and the active spec/plan references.
- Verification: `uv lock`, `bun run docs:build`,
  `test ! -d site/superpowers/specs`, `test ! -d site/superpowers/plans`,
  `rg -n "requirements-docs|setup-python|python -m pip|pip install" ...`,
  and `git diff --check`.
- Decisions: CI uses `astral-sh/setup-uv@v6` and runs
  `uv run --locked mkdocs build --strict` directly, without installing Bun in
  the docs job.
- Follow-up: Add future MkDocs themes or plugins to `pyproject.toml`, then
  refresh `uv.lock`.

### 2026-07-06 - Implement M0.1 contract and quality gates

- Result: Added the M0.1 engineering quality loop around the repository
  skeleton.
- Changed: API readiness, request IDs, JSON error shape, OpenAPI export,
  committed contract snapshot, generated TypeScript API types, API client mock
  fetch, API client tests, initial SQL migration, `.env.example`, MkDocs
  config, uv-backed docs tooling, Dockerfile, GitHub Actions CI, README
  commands, and M0.1 plan.
- Verification: `bun run api:types`, hash comparison for
  `contracts/openapi.json` and `packages/api-client/src/generated.ts`,
  `bun run lint`, `bun run lint:styles`, `bun run typecheck`,
  `bun run build`, `bun run test`,
  `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`,
  `cargo fmt --all --check`,
  `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check`,
  `uv run --locked mkdocs build --strict`,
  `test ! -d site/superpowers/specs`, `test ! -d site/superpowers/plans`,
  `docker build -f Dockerfile.api .`, temporary PostgreSQL 16 container
  readiness via `docker exec ... pg_isready`,
  `DATABASE_URL=postgres://campus_agora:campus_agora@127.0.0.1:55432/campus_agora cargo sqlx migrate run --source crates/db/migrations`,
  and `git diff --check`.
- Decisions: Used a minimal deterministic local OpenAPI/TypeScript generator
  instead of adding a heavier OpenAPI codegen dependency in M0.1.
- Follow-up: No remaining local Docker/sqlx blocker; rerun the same migration
  smoke test when migrations change.

### 2026-07-06 - Define AI collaboration rules

- Result: Added project-level AI collaboration rules and created AI LOG files.
- Changed: `AGENTS.md`, `docs/ai-log/todo.md`, and `docs/ai-log/done.md`.
- Verification: `git diff --check` and
  `rg -n "[ \t]+$" AGENTS.md docs/ai-log/todo.md docs/ai-log/done.md`.
- Decisions: Kept the rule set lightweight in `AGENTS.md`; deferred a fuller
  engineering guide to M0.2 governance docs.
- Follow-up: Apply the AI LOG workflow to future non-trivial agent tasks.

### 2026-07-06 - Initialize M0 repository skeleton

- Result: Created the runnable Campus Agora M0 skeleton and merged it through
  PR #1.
- Changed: Web app, Tauri shell, Rust workspace, API client package, workspace
  scripts, Apache-2.0 license, repository metadata, and M0 implementation plan.
- Verification: `bun run lint`, `bun run lint:styles`, `bun run typecheck`,
  `bun run build`, `bun run test`,
  `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`,
  `cargo fmt --all --check`,
  `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check`, and
  `git diff --check`.
- Decisions: Kept M0 limited to a runnable skeleton; deferred contract
  generation, CI hardening, governance docs, and MkDocs publishing to later
  milestones.
- Follow-up: Start M0.1 contract and quality gates.

### 2026-07-06 - Compress repository history

- Result: Rewrote `main` into a two-commit history.
- Changed: Squashed previous docs/spec iteration commits into
  `docs: add campus agora initialization spec`, followed by
  `chore: initialize m0 repository skeleton`.
- Verification: Compared the rewritten `HEAD` with the previous remote `main`
  tree and confirmed no file content diff.
- Decisions: Kept the final project tree unchanged while making history easier
  to review.
- Follow-up: Future history rewrites should be explicit user requests.
