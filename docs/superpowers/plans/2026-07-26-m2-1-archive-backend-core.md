# M2.1 Archive Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the backend half of M2: knowledge archive entries that can be created, edited, listed, read, versioned, and corrected through `/api/v1/knowledge-entries`, with visibility and permission checks enforced in backend policy.

**Architecture:** Domain owns the archive entry value objects, the moderation/visibility state machine, and the archive permission actions, extending the existing action/resource matrix. Application owns the archive repository ports and the use cases, which是 the first real consumer of `campus_agora_domain::decide` — closing the M1 follow-up that left the policy without a call seam. Db owns the M2 migration (archive metadata, maintainers, corrections) and the SQLx repositories, where every query carries a visibility predicate. Api exposes the REST resource and extends the OpenAPI contract.

**Tech Stack:** Rust/Axum/SQLx/PostgreSQL, existing M1 auth session middleware.

---

## Why M2 Is Split

`docs/product/milestones.md` M2 covers both the archive backend and the frontend list/detail/editor flows built on a shared component system that does not exist yet (`apps/web/src/components/ui` currently holds only `Button.tsx`). The repository already has a precedent for splitting a large milestone into sub-phases (M0 → M0/M0.1/M0.2), and each half produces working, testable software on its own.

- **M2.1 (this plan):** archive backend closed loop, verifiable through API integration tests and the contract.
- **M2.2 (follow-up plan):** `components/ui` primitives plus the archive list/detail/editor flows.

M2 is complete only when both land; `docs/product/milestones.md` keeps M2 as one milestone and records the split.

## Boundaries

In scope (from M2 核心范围): create, edit, list, search-lite, detail; tags, categories, applicable audience, source fields; version history; correction entry point; basic visibility rules.

Not in scope (M2 非目标): AI-generated drafts, a full-text search engine, real-time collaboration, attachments. Also deferred: discussion posts and comments (M3), moderation queue (M4).

Decisions:

- **Entities.** Archive entries reuse the existing `posts` table with `post_type = 'knowledge'`, and reuse `post_revisions` for version history. M2.1 adds archive metadata columns, a `post_maintainers` table for the `Maintainer` resource role, and a `post_corrections` table for the correction entry point. Reusing `posts` keeps discussion (M3) on the same spine, which the spec's table list already anticipated.
- **State machine.** `ModerationStatus` transitions are `Draft → Published`, `Draft → Rejected`, `Published → Hidden`, `Hidden → Published`, `Rejected → Draft`. Anything else is `invalid_moderation_transition` (409). `Archived` from the spec's enum is deferred to M3, which owns content-state transitions.
- **Visibility.** A guest or non-owner sees an entry only when `moderation_status = 'published'` and `deleted_at is null`. Owners, assigned maintainers, moderators, and admins additionally see their own drafts and hidden entries. Invisible entries return `404`, never `403`, so private entries do not leak their existence — this is already the documented rule in `auth-permissions.md`.
- **Permissions.** M2.1 introduces `ArchiveActor` construction in the application layer: it loads the entry, derives `is_resource_author` / `is_assigned_maintainer` / `is_organization_member`, and calls `campus_agora_domain::is_allowed`. `PublishArchiveEntry` currently returns `Conditional` for `Author` and `OrganizationMember`, which `is_allowed` denies; M2.1 resolves that condition by defining it as "an author may publish their own draft", updating both the matrix doc and the domain policy in the same change.
- **Versioning.** Every update to a published entry writes a new `post_revisions` row and bumps `posts.current_revision`, inside one transaction. Draft edits update in place without a revision, because a draft has no published history to preserve.
- **Corrections.** A correction is a lightweight report against a published entry: any authenticated user can file one; the author, maintainers, moderators, and admins can resolve it. Corrections do not edit content directly — that stays an explicit maintainer action.
- **Pagination.** `page`/`pageSize` per the spec's `PaginatedResponse<T>`: `items`, `page`, `pageSize`, `totalItems`, `totalPages`. `page` starts at 1, `pageSize` defaults to 20 and is capped at 100.
- **Search-lite.** `q` does a case-insensitive `ILIKE` over title and summary; `tag` and `category` filter exactly. No full-text engine, no ranking.

## File Structure

- Create `crates/domain/src/archive.rs`: `ModerationStatus`, `PostKind`, `ArchiveCategory`, `ApplicableAudience`, `SourceKind`, title/summary/body/tag validation, `can_transition`.
- Modify `crates/domain/src/permissions.rs`: resolve the `PublishArchiveEntry` condition for authors; add `ViewArchiveEntry` and `FileCorrection` / `ResolveCorrection` actions.
- Modify `crates/domain/src/lib.rs` and add `crates/domain/tests/archive.rs`.
- Create `crates/application/src/archive/{mod,service}.rs`: `ArchiveService` with `create_draft`, `update_entry`, `publish_entry`, `list_entries`, `get_entry`, `file_correction`, `resolve_correction`; `ArchiveActor` construction from a session plus entry context.
- Modify `crates/application/src/ports.rs`: `ArchiveRepository`, `CorrectionRepository`, records, `ListArchiveQuery`, `Page<T>`.
- Modify `crates/application/src/memory.rs`: in-memory implementations kept behaviorally identical to PostgreSQL (the M1 review showed divergence hides bugs).
- Create `crates/db/migrations/20260727000000_m2_archive_core.sql`; modify `crates/db/src/repositories.rs`; extend `crates/db/tests/{migrations,repositories}.rs`.
- Create `crates/api/src/archive.rs` (DTOs, handlers, query parsing); modify `crates/api/src/lib.rs` (routes, OpenAPI); create `crates/api/tests/archive.rs`.
- Modify `contracts/openapi.json` and `packages/api-client/src/generated.ts` (generated), `packages/api-client/src/archive.ts`, `mock.ts`, `index.ts`, tests.
- Modify docs: `docs/architecture/auth-permissions.md`, `docs/architecture/api-contracts.md`, `docs/product/milestones.md`, `docs/ai-log/{todo,done}.md`.

## Tasks

### Task 1: Plan And AI Log

- [ ] Save this plan.
- [ ] Add the M2.1 entry to `docs/ai-log/todo.md` and close the "permission policy call seam" todo by pointing at this plan.
- [ ] Record the M2 split in `docs/product/milestones.md` and set M2 to 进行中.

### Task 2: Domain Archive Types And State Machine

- [ ] Write failing tests in `crates/domain/tests/archive.rs`: `ModerationStatus` string round-trip; `can_transition` allows Draft→Published, Draft→Rejected, Published→Hidden, Hidden→Published, Rejected→Draft and rejects Published→Draft, Rejected→Published, and every self-transition; title validation (trimmed, 1..=200 chars); summary validation (optional, <=500 chars); body non-empty; tag list normalization (trimmed, lowercased, deduped, <=10 tags, each 1..=32 chars); `ArchiveCategory`/`ApplicableAudience`/`SourceKind` round-trip.
- [ ] Implement `crates/domain/src/archive.rs` and re-export from `lib.rs`.
- [ ] Run `cargo test -p campus_agora_domain` green.

### Task 3: Domain Permission Actions For Archive

- [ ] Write failing tests in `crates/domain/tests/permissions.rs`: `ViewArchiveEntry` is Allow for everyone (visibility is enforced by the repository predicate, not by the matrix); `PublishArchiveEntry` is now Allow for an `Author` (resolving the previous `Conditional`) and still Deny for a bare Student; `FileCorrection` requires authentication; `ResolveCorrection` is Allow for Author, assigned Maintainer, Moderator, Admin and Deny for a bare Student.
- [ ] Extend `Action` and the `cell` matrix accordingly; keep the union-of-grants fold documented in `auth-permissions.md`.
- [ ] Update the permission matrix table in `docs/architecture/auth-permissions.md` in the same change, including removing `Conditional` from the Publish row's Author column.
- [ ] Run `cargo test -p campus_agora_domain` green.

### Task 4: Application Ports And In-Memory Store

- [ ] Write failing tests in `crates/application/tests/archive_service.rs` covering the in-memory store: create draft returns revision 1 and `Draft`; a bare student cannot publish another user's draft (`Forbidden`); the author can publish their own draft; updating a published entry creates revision 2 and bumps `current_revision`; updating a draft does not create a revision; an invalid transition returns `Conflict`; listing as a guest returns only published entries; listing as the author includes their own draft; fetching an invisible entry returns `NotFound` rather than `Forbidden`; filing a correction requires auth; resolving a correction requires author/maintainer/moderator/admin.
- [ ] Implement `ports.rs` additions (`ArchiveRepository`, `CorrectionRepository`, `ArchiveEntryRecord`, `NewArchiveEntry`, `ArchiveUpdate`, `ListArchiveQuery`, `Page<T>`, `CorrectionRecord`), the in-memory implementations, and `archive/service.rs` including `ArchiveActor` construction that calls `campus_agora_domain::is_allowed`.
- [ ] Run `cargo test -p campus_agora_application` green.

### Task 5: Migration And PostgreSQL Repositories

- [ ] Extend `crates/db/tests/migrations.rs` with failing static assertions: the M2 migration adds `category`, `applicable_audience`, `source_kind`, `source_reference`, `visibility` columns to `posts`; creates `post_maintainers` with `unique (post_id, user_id)`; creates `post_corrections` with a status check and a resolver reference; adds indexes on `post_type, moderation_status`, on `tags` (GIN), and on `post_corrections(post_id)`.
- [ ] Add `crates/db/migrations/20260727000000_m2_archive_core.sql`.
- [ ] Implement the PostgreSQL `ArchiveRepository` and `CorrectionRepository`. Every read carries the visibility predicate in SQL; the update path runs in one transaction that writes `post_revisions` and bumps `current_revision`.
- [ ] Extend `crates/db/tests/repositories.rs` (DATABASE_URL-gated) to exercise create, visibility filtering for guest vs author, revision creation on publish-then-update, correction insert and resolve, and the pagination total.
- [ ] Run `cargo test -p campus_agora_db` with and without `DATABASE_URL`.

### Task 6: API Resource And Contract

- [ ] Write failing tests in `crates/api/tests/archive.rs`: `POST /api/v1/knowledge-entries` requires auth (401) and returns 201 with the created entry; `GET /api/v1/knowledge-entries` returns the paginated envelope and hides unpublished entries from guests; `GET /api/v1/knowledge-entries/{id}` returns 404 for an invisible entry; `PATCH` enforces permissions (403 for a non-owner student) and creates a revision for a published entry; `POST /api/v1/knowledge-entries/{id}/publish` rejects an invalid transition with 409 `invalid_moderation_transition`; `GET /api/v1/knowledge-entries/{id}/revisions` lists history; `POST /api/v1/knowledge-entries/{id}/corrections` requires auth; `PATCH .../corrections/{correctionId}` enforces the resolver permission; invalid `pageSize` returns 422.
- [ ] Implement `crates/api/src/archive.rs` and wire the routes into `build_router_with_state_and_config`.
- [ ] Extend `openapi_document()` with the paths, the `PaginatedKnowledgeEntries` envelope, and all new schemas; document every status each handler can return, including 500.
- [ ] Extend `crates/api/tests/openapi.rs` to assert the new paths, security requirements, and schemas.
- [ ] Run `cargo test -p campus_agora_api` green.

### Task 7: Contract Regeneration And API Client

- [ ] Run `bun run api:types`; commit the regenerated contract and types.
- [ ] Write failing Bun tests for the archive resource client and for mock parity (the mock must reproduce 401/403/404/409/422 and the pagination envelope exactly as the server does).
- [ ] Implement `packages/api-client/src/archive.ts`, extend the client, the mock, and `index.ts`.
- [ ] Run `bun --cwd packages/api-client test` and `bun run typecheck` green.

### Task 8: Docs And Verification

- [ ] Update `docs/architecture/api-contracts.md`: new error codes (`invalid_moderation_transition`, `entry_not_found`), the pagination envelope, and the archive endpoints.
- [ ] Update `docs/product/milestones.md` M2 progress and `docs/product/privacy.md` if the archive adds a data-inventory row (source references can carry third-party URLs).
- [ ] Run the full gate set: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` against dockerized PostgreSQL 16, `bun run api:check`, `bun run typecheck`, `bun run lint`, `bun run lint:styles`, `bun run test`, `bun run build`, `bun run ci:docs`, `git diff --check`.
- [ ] Move M2.1 facts into `docs/ai-log/done.md`.
- [ ] Commit in reviewable increments.
