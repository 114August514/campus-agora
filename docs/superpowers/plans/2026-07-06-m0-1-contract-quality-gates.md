# M0.1 Contract And Quality Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the M0.1 engineering quality loop around the existing Campus Agora skeleton.

**Architecture:** Keep runtime behavior minimal while establishing verifiable boundaries. The Rust API owns readiness, request IDs, error shape, and OpenAPI export; `packages/api-client` owns generated TypeScript contract types, request normalization, and mock fetch behavior; repository-level scripts and CI wire the checks together.

**Tech Stack:** Rust/Axum/Tower HTTP/SQLx, Bun/TypeScript, React/Vite, MkDocs, GitHub Actions, Docker.

---

## File Structure

- Modify `crates/api/src/lib.rs` for `/readyz`, request IDs, uniform fallback errors, app state, and OpenAPI JSON.
- Create `crates/api/src/bin/export-openapi.rs` to write `contracts/openapi.json`.
- Modify `crates/api/tests/health.rs` to cover readiness, request ID propagation, error shape, meta flags, and contract content.
- Modify `crates/api/Cargo.toml` and root `Cargo.toml` for SQLx dependencies.
- Create `contracts/openapi.json`.
- Create `packages/api-client/scripts/generate-types.ts` and `packages/api-client/src/generated.ts`.
- Modify `packages/api-client/src/request.ts`, `meta.ts`, and `index.ts`; create `mock.ts` and `*.test.ts`.
- Create `crates/db/migrations/20260706000000_init.sql` and `crates/db/tests/migrations.rs`.
- Create `.env.example`, `Dockerfile.api`, `mkdocs.yml`, `pyproject.toml`, `uv.lock`, `docs/index.md`, `scripts/README.md`, `scripts/build.sh`, `scripts/ci/*.sh`, and `.github/workflows/ci.yml`.
- Modify root and package scripts for `api:types`, `api:check`, `docs:build`, `ci:*`, and CI parity.

## Tasks

### Task 1: Plan And AI Log

- [x] Mark `docs/ai-log/todo.md` M0.1 as in progress.
- [x] Save this plan to `docs/superpowers/plans/2026-07-06-m0-1-contract-quality-gates.md`.

### Task 2: API Readiness, Error Shape, And Request IDs

- [x] Write failing Rust API integration tests for `/readyz`, fallback 404 JSON error, `X-Request-Id`, and meta capability flags.
- [x] Add `ApiState`, `ReadinessProbe`, `/readyz`, fallback error response, and request ID layers in `crates/api/src/lib.rs`.
- [x] Add SQLx PostgreSQL dependency and production readiness probe using `DATABASE_URL`.
- [x] Run `cargo test -p campus_agora_api --test health` and confirm green.

### Task 3: OpenAPI Contract Export

- [x] Write failing contract tests asserting OpenAPI 3.1, `/healthz`, `/readyz`, `/api/v1/meta`, error schema, and capability schema.
- [x] Add `openapi_document()` and `export-openapi` binary.
- [x] Generate `contracts/openapi.json`.
- [x] Run `cargo run -p campus_agora_api --bin export-openapi -- contracts/openapi.json` and verify generation idempotence by hash comparison.

### Task 4: Generated API Types, Client Wrapper, And Mock Boundary

- [x] Add failing Bun tests for success, JSON errors, 401/403/404/409/422/429, network failure, request ID header, and mock fetch responses.
- [x] Add deterministic Bun type generator from `contracts/openapi.json` to `packages/api-client/src/generated.ts`.
- [x] Update `requestJson`, `createCampusAgoraApiClient`, and mock exports to consume generated types.
- [x] Run `bun run api:types`, `bun --cwd packages/api-client test`, and root `bun run typecheck`.

### Task 5: Migration, Environment, Docs, Docker, And CI

- [x] Add `.env.example` with non-secret local/dev/staging/production variables.
- [x] Add initial SQL migration and migration structure tests.
- [x] Add MkDocs minimal docs configuration excluding `docs/superpowers/specs/**` from navigation and site output.
- [x] Add `Dockerfile.api` for the Rust API server.
- [x] Add `.github/workflows/ci.yml` with frontend, backend, desktop, contract, docs, and container jobs.
- [x] Add `scripts/ci/*.sh` wrappers so CI jobs and local reproduction use the same command sets.
- [x] Run local checks, including Docker image build and PostgreSQL migration smoke test through `cargo sqlx`.

### Task 6: Final Verification

- [x] Run frontend lint/style/typecheck/test/build.
- [x] Run Rust fmt/check/clippy/test and Tauri cargo check.
- [x] Run contract generation/check and API client type generation/check.
- [x] Run docs build if MkDocs dependencies are available.
- [x] Run Docker build and PostgreSQL migration smoke test with local Docker and `cargo sqlx`.
- [x] Update `docs/ai-log/done.md` and remove or close the M0.1 todo entry.
