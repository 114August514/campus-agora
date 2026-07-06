# M0 Repository Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest runnable Campus Agora monorepo skeleton for Web, Tauri WebView, Rust API, and shared workspace tooling.

**Architecture:** The first slice proves the repository shape, local commands, and smoke endpoints without implementing product workflows. Runtime code stays minimal: `apps/web` renders an `AppShell`, `crates/api` serves `/healthz` and `/api/v1/meta`, `apps/desktop` loads the Web app through Tauri, and `packages/api-client` exposes a typed client boundary.

**Tech Stack:** Bun workspace, React/Vite/TypeScript, CSS variables, Rust workspace, Axum, SQLx-ready crate boundary, Tauri v2 shell.

---

### Task 1: Repository Tooling

**Files:**
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.gitattributes`
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `AGENTS.md`
- Create: `package.json`
- Create: `rust-toolchain.toml`
- Create: `Cargo.toml`

- [x] **Step 1: Create repository-level config**

Add editor, ignore, LFS, root Bun workspace, and Rust workspace files. Keep `.sqlx/` trackable and keep reference `ref*.md` files untracked.

- [x] **Step 2: Add root scripts**

Expose these root scripts in `package.json`: `dev`, `dev:web`, `dev:api`, `dev:desktop`, `typecheck`, `lint`, `lint:styles`, `test`, `build`.

- [x] **Step 3: Verify baseline commands are discoverable**

Run: `bun --version` and `cargo --version`.

Expected: both commands print versions, or dependency setup is reported as blocked.

### Task 2: Rust API Skeleton

**Files:**
- Create: `crates/domain/Cargo.toml`
- Create: `crates/domain/src/lib.rs`
- Create: `crates/application/Cargo.toml`
- Create: `crates/application/src/lib.rs`
- Create: `crates/db/Cargo.toml`
- Create: `crates/db/src/lib.rs`
- Create: `crates/api/Cargo.toml`
- Create: `crates/api/src/lib.rs`
- Create: `crates/api/src/main.rs`
- Create: `crates/api/tests/health.rs`

- [x] **Step 1: Add API smoke tests first**

Write integration tests that assert `/healthz` returns `ok` and `/api/v1/meta` returns `Campus Agora` with a semantic skeleton version.

- [x] **Step 2: Run test to verify it fails**

Run: `cargo test -p campus_agora_api`.

Expected: FAIL before implementation because the crate and routes do not exist.

- [x] **Step 3: Implement minimal Axum app**

Implement `build_router()` in `crates/api/src/lib.rs` and call it from `main.rs`. Keep domain/application/db crates as empty compileable boundaries.

- [x] **Step 4: Verify Rust skeleton**

Run: `cargo fmt --all --check`, `cargo check --workspace --all-targets`, and `cargo test -p campus_agora_api`.

Expected: all commands pass.

### Task 3: Web App Skeleton

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/components/layout/AppShell.tsx`
- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/themes.css`
- Create: `apps/web/src/styles/globals.css`

- [x] **Step 1: Add minimal Web skeleton**

Create a strict TypeScript React/Vite application with `AppShell`, a small Button primitive, and design token CSS.

- [x] **Step 2: Verify Web typecheck and build**

Run: `bun install`, `bun run typecheck`, and `bun run build`.

Expected: dependency installation succeeds and Web app typechecks/builds.

### Task 4: API Client Package Skeleton

**Files:**
- Create: `packages/api-client/package.json`
- Create: `packages/api-client/tsconfig.json`
- Create: `packages/api-client/src/index.ts`
- Create: `packages/api-client/src/request.ts`
- Create: `packages/api-client/src/meta.ts`

- [x] **Step 1: Add typed API client boundary**

Create `createCampusAgoraApiClient()` with `getHealth()` and `getMeta()` methods. The generated OpenAPI client remains M0.1 work.

- [x] **Step 2: Connect Web app to package boundary**

Add a workspace dependency from `apps/web` to `@campus-agora/api-client`. The Web app may render static state in M0 but must compile against the package.

- [x] **Step 3: Verify workspace typecheck**

Run: `bun run typecheck`.

Expected: root typecheck covers `apps/web` and `packages/api-client`.

### Task 5: Tauri Shell Skeleton

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/build.rs`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/capabilities/default.json`
- Create: `apps/desktop/src-tauri/src/main.rs`

- [x] **Step 1: Add minimal Tauri shell**

Create a Tauri v2 shell that loads the Web dev server in development and the Web dist output in production. Keep capabilities minimal.

- [x] **Step 2: Verify desktop crate**

Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`.

Expected: desktop crate compiles or reports missing platform prerequisites clearly.

### Task 6: M0 Smoke Verification

**Files:**
- Modify: `README.md`

- [x] **Step 1: Document M0 commands**

Document how to install dependencies, run Web, run API, run desktop shell, and run smoke checks.

- [x] **Step 2: Run M0 verification commands**

Run: `bun run typecheck`, `bun run build`, `cargo check --workspace --all-targets`, `cargo test -p campus_agora_api`, and `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`.

Expected: all feasible M0 checks pass. If network or platform dependencies block a command, record the exact blocker.

- [x] **Step 3: Commit**

Commit only M0 skeleton files. Do not commit root reference files such as `ref*.md`, `temp*.md`, `api.md`, `backend.md`, `frontend.md`, or `monorepo.md`.
