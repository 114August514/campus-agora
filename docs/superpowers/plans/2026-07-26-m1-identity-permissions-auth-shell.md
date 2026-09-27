# M1 Identity, Permissions And Auth Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the M1 milestone: auth provider abstraction, mock campus auth, user/organization/role models, backend permission policy tests, session lifecycle, and a frontend login-state shell, without binding to a real campus provider.

**Architecture:** Domain owns pure roles and the permission matrix from `docs/architecture/auth-permissions.md`. Application owns the `AuthProvider` abstraction, `MockCampusAuthProvider`, repository traits, and the auth use cases (login, current session, logout) with hashed opaque session tokens and audit events. Db owns the M1 migration and PostgreSQL repository implementations. Api wires an auth runtime (PostgreSQL-backed when `DATABASE_URL` is set, in-memory fallback otherwise), exposes `/api/v1/auth/*`, and extends the OpenAPI contract. The API client gains bearer-token strategy and auth resource methods; the web shell displays login state through backend APIs only.

**Tech Stack:** Rust/Axum/SQLx/PostgreSQL, uuid/chrono/rand/sha2/async-trait, Bun/TypeScript, React/Vite.

---

## Boundaries

In scope (from `docs/product/milestones.md` M1): auth provider abstraction, mock campus auth provider, user/organization-membership/role models, backend permission policies and tests, frontend login state and auth-aware API client, session/token storage policy for Web and Tauri WebView.

Not in scope: real CAS/OIDC, admin dashboard, anonymous posting, file uploads, public write launch, cookie/CSRF session mode, rate limiting implementation.

Decisions:

- Session strategy: opaque 256-bit random token, stored server side as SHA-256 hash with expiry (`SESSION_TTL_SECONDS`, default 86400) and revocation; clients send `Authorization: Bearer <token>`. Web/Tauri WebView keep the token in tab-scoped `sessionStorage`, never `localStorage`.
- Mock provider verifies fixed personas (`student`, `organization_member`, `moderator`, `admin`); the org persona also provisions a demo organization and membership. Personas map to deterministic subjects; users upsert by `(auth_provider, provider_subject_hash)`.
- Permission matrix cells: `Allow`/`Deny` map directly; "Allow if member/assigned"/"Own data only" resolve from actor context flags; "Conditional" returns `PermissionDecision::Conditional` and is denied at runtime until a later milestone binds resource state.
- `POST /api/v1/auth/mock-login` returns `403 auth_mock_disabled` when `AUTH_MOCK_ENABLED=false`; invalid persona returns `422 validation_failed`; missing/invalid/expired bearer returns `401 unauthorized`.
- Login and logout write audit events (`auth.login`, `auth.logout`) without raw tokens.

## File Structure

- Modify root `Cargo.toml` workspace deps: add `uuid`, `chrono`, `rand`, `sha2`, `async-trait`; extend sqlx features with `uuid`, `chrono`, `migrate`.
- Create `crates/domain/src/{ids,roles,permissions,users}.rs`; modify `crates/domain/src/lib.rs` and `crates/domain/Cargo.toml`.
- Create `crates/application/src/{errors,ports,memory}.rs` and `crates/application/src/auth/{mod,provider,service}.rs`; modify `crates/application/src/lib.rs` and `Cargo.toml`.
- Create `crates/db/migrations/20260726000000_m1_identity_sessions.sql`, `crates/db/src/{pool,repositories}.rs`, `crates/db/tests/repositories.rs`; modify `crates/db/src/lib.rs`, `crates/db/tests/migrations.rs`, `Cargo.toml`.
- Create `crates/api/src/auth.rs` (DTOs, handlers, bearer extraction, error mapping); modify `crates/api/src/lib.rs` (state wiring, routes, OpenAPI), `crates/api/tests/health.rs` or new `crates/api/tests/auth.rs`, `crates/api/tests/openapi.rs`, `Cargo.toml`.
- Modify `packages/api-client/scripts/generate-types.ts` (array support), `src/{request,meta,mock,index}.ts`; create `src/auth.ts`; extend `tests/client.test.ts`; regenerate `contracts/openapi.json` and `src/generated.ts`.
- Create `apps/web/src/lib/api.ts`, `apps/web/src/features/auth/{session.ts,useSession.ts}`, `apps/web/src/features/auth/ui/AuthPanel.tsx`; modify `apps/web/src/app/App.tsx`, `components/layout/AppShell.tsx`, `styles/globals.css`.
- Modify docs: `docs/architecture/auth-permissions.md`, `docs/architecture/backend.md`, `docs/architecture/api-contracts.md`, `docs/product/privacy.md`, `docs/product/milestones.md`, `.env.example`, `docs/ai-log/{todo,done}.md`.

## Tasks

### Task 1: Plan, AI Log, Milestone State

- [x] Save this plan to `docs/superpowers/plans/2026-07-26-m1-identity-permissions-auth-shell.md`.
- [x] Add the M1 task entry to `docs/ai-log/todo.md`.
- [x] Update `docs/product/milestones.md` current-phase section and summary table: M0.2 completed, M1 in progress.

### Task 2: Domain Roles, IDs, Permission Matrix

- [x] Add workspace deps (`uuid`, `chrono`) and domain crate deps.
- [x] Write failing domain tests: `SystemRole` parse/serialize round-trip; display-name validation (trimmed, non-empty, max 64 chars); permission matrix conformance for every action row of `docs/architecture/auth-permissions.md`, covering guest, student, org member (member and non-member), author, assigned maintainer, moderator, admin, and `Conditional` cells; `is_allowed` denies `Conditional`.
- [x] Implement `ids.rs` (UserId/OrganizationId/SessionId newtypes over `Uuid`), `roles.rs` (`SystemRole`), `users.rs` (`AuthProviderKind`, `validate_display_name`), `permissions.rs` (`Action`, `Actor`, `AuthenticatedActor` context flags, `PermissionDecision`, `decide`, `is_allowed`).
- [x] Run `cargo test -p campus_agora_domain` green.

### Task 3: Application Auth Provider, Use Cases, In-Memory Ports

- [x] Write failing application tests: mock provider verifies each persona and rejects unknown ones; login creates a user once and reuses it on the second login; org persona provisions organization and membership; session token is returned in plaintext exactly once while only a SHA-256 hash is stored; `current_user` resolves an active session and rejects unknown, expired, and revoked tokens with `Unauthorized`; logout revokes the session; login and logout record `auth.login`/`auth.logout` audit events without raw tokens.
- [x] Implement `errors.rs` (`ApplicationError`), `auth/provider.rs` (`AuthCredential`, `VerifiedCampusIdentity`, `AuthProvider` trait, `MockCampusAuthProvider`), `ports.rs` (records plus `UserRepository`, `SessionRepository`, `OrganizationRepository`, `AuditEventRepository` traits), `memory.rs` (in-memory implementations), `auth/service.rs` (`AuthService` with `login`, `current_user`, `logout`, TTL config, token generation via `rand`, hashing via `sha2`).
- [x] Run `cargo test -p campus_agora_application` green.

### Task 4: DB Migration And PostgreSQL Repositories

- [x] Extend `crates/db/tests/migrations.rs` with failing static assertions: M1 migration file exists and defines `organizations`, `organization_memberships` (unique member per org), `sessions` (`token_hash` unique, `expires_at`, `revoked_at`), and required indexes; no plaintext token column.
- [x] Add `20260726000000_m1_identity_sessions.sql`.
- [x] Implement `pool.rs` (`connect_lazy` helper) and `repositories.rs` (SQLx implementations of the four traits, runtime queries, explicit row structs).
- [x] Add `tests/repositories.rs`: skip with a notice when `DATABASE_URL` is unset; otherwise load the migration directory at runtime through `sqlx::migrate::Migrator::new` (not the `sqlx::migrate!` macro, which would require the `macros` feature and therefore `.sqlx` offline metadata) and exercise user upsert, session insert/find/revoke/expiry, organization upsert + membership listing, audit insert.
- [x] Run `cargo test -p campus_agora_db` (without DB) green; full run against dockerized PostgreSQL 16 in Task 9.

### Task 5: API Auth Endpoints, State Wiring, OpenAPI

- [x] Write failing API integration tests (`tests/auth.rs`): mock-login happy path returns token, expiry, and user with role and organizations; disabled flag returns `403 auth_mock_disabled`; invalid persona returns `422 validation_failed`; `GET /api/v1/auth/session` with valid bearer returns the user, and returns `401 unauthorized` JSON error with request id when the header is missing, malformed, or the token is unknown; `POST /api/v1/auth/logout` returns `204` and the token stops working afterwards.
- [x] Extend `tests/openapi.rs`: contract contains the three auth paths, `bearerAuth` security scheme, `security: []` on public operations, bearer security on session/logout, and the new schemas.
- [x] Implement `auth.rs` (DTOs with `serde(rename_all = "camelCase")`, handlers, bearer extraction, `ApplicationError` → HTTP mapping) and wire `AuthRuntime` into `ApiState` (PostgreSQL repositories when `DATABASE_URL` is set, in-memory otherwise; `SESSION_TTL_SECONDS` config; `ApiErrorResponse.message` becomes `String`).
- [x] Extend `openapi_document()` with securitySchemes, paths, and schemas.
- [x] Run `cargo test -p campus_agora_api` green.

### Task 6: Contract Regeneration And API Client Auth

- [x] Extend `generate-types.ts` with array (`items`) support.
- [x] Run `bun run api:types`; commit regenerated `contracts/openapi.json` and `generated.ts`.
- [x] Write failing Bun tests: `requestJson` sends `Authorization` from `authToken`, supports POST bodies and 204 responses; auth client `mockLogin`/`getSession`/`logout` round-trip against the stateful mock fetch; session route returns 401 without a token.
- [x] Implement `request.ts` extensions (method/body/204/authToken), `auth.ts` resource client, `createCampusAgoraApiClient` auth options, mock fetch auth routes, `index.ts` exports.
- [x] Run `bun --cwd packages/api-client test` green.

### Task 7: Web Login-State Shell

- [x] Add `lib/api.ts` (client instance reading `VITE_API_BASE_URL`, token source from the auth session store).
- [x] Add `features/auth/session.ts` (sessionStorage-backed token store with subscribe; never localStorage) and `features/auth/useSession.ts` (`loading`/`guest`/`authenticated`/`error` states, `login(persona)`, `logout()`).
- [x] Add `features/auth/ui/AuthPanel.tsx` (persona select + 登录 when guest; display name, role, organizations, 退出登录 when authenticated; inline error message with retry) and render it in the shell; show an authenticated-state card in `App.tsx`.
- [x] Style with existing tokens in `globals.css`; keep copy in Chinese.
- [x] Run `bun run typecheck`, `bun run lint`, `bun run lint:styles`, `bun run build` green.

### Task 8: Docs Sync

- [x] `docs/architecture/auth-permissions.md`: M1 implementation boundaries — personas, session token policy (opaque token, SHA-256 at rest, TTL, bearer transport), Web/Tauri sessionStorage policy, endpoints, error codes, audit events; refresh `Last updated`.
- [x] `docs/architecture/backend.md`: add `SESSION_TTL_SECONDS` and the auth runtime fallback rule to configuration.
- [x] `docs/architecture/api-contracts.md`: document bearer security scheme usage for protected endpoints.
- [x] `docs/product/privacy.md`: add session-record row to the data inventory and retention table.
- [x] `.env.example`: add `SESSION_TTL_SECONDS=86400`.
- [x] Run `bun run ci:docs` green.

### Task 9: Full Verification And Handoff

- [x] `bun install --frozen-lockfile`, `bun run api:check`, `bun run typecheck`, `bun run lint`, `bun run lint:styles`, `bun run test`, `bun run build`.
- [x] `cargo fmt --all --check`, `cargo check --workspace --all-targets`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
- [x] Start disposable PostgreSQL 16 via Docker; run `cargo sqlx migrate run --source crates/db/migrations` and `cargo test -p campus_agora_db` with `DATABASE_URL` set; stop the container.
- [x] `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run ci:docs`, `git diff --check`.
- [x] Move the M1 AI LOG entry facts into `docs/ai-log/done.md`.
- [x] Commit in reviewable increments.
