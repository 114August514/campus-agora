# M3.1 Discussion To Archive Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver the backend half of M3: discussion posts and replies, an accepted-answer flow, and a traceable path from a discussion into an archive entry, so a valuable reply can become durable knowledge without losing where it came from.

**Architecture:** Discussions reuse the `posts` spine that M2 already established, distinguished by `post_type = 'discussion'`, so revisions, moderation vocabulary, and the visibility predicate carry over unchanged. Replies land in a new `comments` table. A new `archive_sources` table records the discussion post or comment an archive entry was drawn from, which is what makes the loop traceable in both directions. Domain gains the `Archived` state the M2 state machine deliberately deferred.

**Tech Stack:** Rust/Axum/SQLx/PostgreSQL, existing M1 session and M2 archive layers.

---

## Why M3 Is Split

M3's core scope covers both the discussion backend and the UI that must visibly distinguish transient discussion from durable archive content. `apps/web` has the primitives now, but the discussion flows, the promote-to-archive flow, and the source-linkage display are a second body of work. Same precedent as M0 and M2.

- **M3.1 (this plan):** discussion backend, accepted answers, promotion and source linkage, contract, client, mock.
- **M3.2 (follow-up plan):** discussion list/detail/reply flows, the promote action, and source-linkage display.

M3 reaches its exit criteria only when both land. The milestone is not marked complete until then — M2 was marked 已完成 ahead of its evidence, and that will not be repeated.

## Boundaries

In scope: discussion posts, replies, accepted answer, promoting a discussion or reply into an archive entry, archive-to-discussion source linkage, and the `Archived` content state.

Not in scope (M3 非目标): an anonymous surface as a primary product area, recommendation ranking, WebSocket notifications, moderation automation. Also deferred: threaded reply nesting beyond one level, reactions and vote counts, and full-text search (M5).

Decisions:

- **One spine, two kinds.** A discussion is a `posts` row with `post_type = 'discussion'`. It reuses the moderation vocabulary, the soft-delete columns, and the visibility predicate. Archive-only metadata columns (`category`, `applicable_audience`, `source_kind`) keep their defaults and are not surfaced on discussions.
- **Replies are flat.** `comments` holds one level of reply per discussion. Threading is deliberately out of scope: the product's value is sedimentation, not conversation depth, and a nested tree would complicate both moderation and promotion for no M3 benefit.
- **`Archived` is a status; `deleted` is not.** The milestone lists both. `Archived` joins the moderation state machine as the terminal state for a discussion whose value has been captured elsewhere. Deletion stays the existing `deleted_at`/`deleted_by` soft-delete, because the data-governance rules require recoverable deletion with an audit event, which a status alone does not express. This is documented in `auth-permissions.md` rather than left implicit.
- **Transitions.** Discussion: `Draft → Published`, `Draft → Rejected`, `Published → Hidden`, `Hidden → Published`, `Rejected → Draft`, plus `Published → Archived` and `Archived → Published`. Archive entries gain the same two, so a superseded entry can be retired without deletion.
  - **Revised during implementation.** `Archived → Hidden` was added: without it, archiving would put content beyond moderation reach.
  - **Revised during implementation.** `Archived` is *publicly readable*, not hidden. The plan did not say so, and it has to be: an entry's backlink to its source discussion must resolve, or the milestone's traceable-source exit criterion is unmeetable. A fourth permission action, `ArchiveContent`, was added so retiring one's own content is curation rather than moderation.
- **Accepted answer.** A discussion may mark exactly one comment as accepted. The discussion author, assigned maintainers, moderators, and admins may set or clear it. Accepting is an affordance for finding the useful reply, not a moderation action.
- **Promotion is a new entry, not a move.** Promoting creates an archive entry in `Draft` owned by the promoting user, pre-filled from the source, and records an `archive_sources` row pointing at the discussion post or comment. The source is never mutated or consumed — a discussion can seed several entries, and the reply's author keeps their attribution through the recorded `source_author_id`.
- **Backlinks are queryable both ways.** `archive_sources` is indexed on both the entry and the source, so an entry lists where it came from and a discussion lists what it produced.

## File Structure

- Modify `crates/domain/src/archive.rs`: add `ModerationStatus::Archived`, extend `can_transition`, add comment-body validation; modify `permissions.rs` for `ReplyToDiscussion`, `AcceptAnswer`, `PromoteToArchive`.
- Add `crates/domain/tests/discussion.rs`.
- Create `crates/application/src/discussion/{mod,service}.rs`; modify `ports.rs` (comment and source records plus their repositories), `memory.rs`, and `archive/service.rs` for promotion.
- Create `crates/db/migrations/20260728000000_m3_discussion_loop.sql`; modify `crates/db/src/repositories.rs`; extend `crates/db/tests/{migrations,repositories}.rs`.
- Create `crates/api/src/discussion.rs`; modify `crates/api/src/lib.rs` (routes, OpenAPI); create `crates/api/tests/discussion.rs`.
- Regenerate `contracts/openapi.json` and `packages/api-client/src/generated.ts`; create `packages/api-client/src/discussion.ts`; modify `meta.ts`, `mock.ts`, `index.ts`, tests.
- Modify docs: `docs/architecture/auth-permissions.md`, `docs/architecture/api-contracts.md`, `docs/product/privacy.md`, `docs/product/milestones.md`, `docs/ai-log/{todo,done}.md`.

## Tasks

### Task 1: Plan And AI Log

- [x] Save this plan; add the M3.1 todo entry pointing at it.
- [x] Set M3 to 进行中 in `docs/product/milestones.md` and record the two-phase split.

### Task 2: Domain State Machine And Discussion Types

- [x] Write failing tests in `crates/domain/tests/discussion.rs`: `ModerationStatus::Archived` round-trips; `Published → Archived` and `Archived → Published` are allowed while `Draft → Archived`, `Archived → Draft`, and `Archived → Rejected` are not; comment-body validation trims, rejects empty, bounds at 5,000 characters, and counts characters rather than bytes. **Two assertions were inverted from the plan on purpose:** `Archived → Hidden` *is* allowed, and `Archived` *is* publicly visible — see the revised decisions above. Also added: `ModerationStatus::ALL` with a test that fails to compile when a variant is added without listing it, because the SQL visibility predicate derives its status list from it.
- [x] Extend `crates/domain/src/archive.rs` and re-export.
- [x] Run `cargo test -p campus_agora_domain` green.

### Task 3: Domain Permissions For Discussion

- [x] Write failing tests in `crates/domain/tests/permissions.rs`: `ReplyToDiscussion` requires authentication; `AcceptAnswer` is Allow for the discussion `Author`, an assigned `Maintainer`, `Moderator`, and `Admin`, and Deny for a bare `Student`; `PromoteToArchive` requires authentication only, because promotion creates the promoter's own draft rather than modifying the source.
- [x] Extend `Action` and the matrix; update the table in `docs/architecture/auth-permissions.md` in the same change. A fourth action, `ArchiveContent`, was added beyond the three the plan named.
- [x] Run `cargo test -p campus_agora_domain` green.

### Task 4: Application Ports, Discussion Service, Promotion

- [x] Write failing tests in `crates/application/tests/discussion_service.rs`: creating a discussion starts in `Draft` and reuses the archive visibility rules; a guest cannot reply; replying to an invisible discussion is `NotFound`; listing replies is ordered oldest-first; accepting a comment sets exactly one accepted answer and re-accepting a different one replaces it; a bare student cannot accept on someone else's discussion; clearing the accepted answer works; accepting a comment that belongs to another discussion is `NotFound` (the M2 IDOR class, checked up front this time); promoting creates a `Draft` archive entry owned by the promoter, pre-filled from the source, and records a source row; the source discussion is unmodified; a discussion can be promoted twice into two entries; listing an entry's sources and a discussion's derived entries both work; every promotion and accepted-answer change writes an audit event.
- [x] Implement `ports.rs` additions, `memory.rs` implementations kept behaviorally identical to PostgreSQL, and `discussion/service.rs`.
- [x] Run `cargo test -p campus_agora_application` green.

### Task 5: Migration And PostgreSQL Repositories

- [x] Extend `crates/db/tests/migrations.rs` with failing static assertions: the M3 migration creates `comments` (discussion reference, author, body, soft-delete columns) and `archive_sources` (entry, source post, optional source comment, source author, unique per entry-source pair); adds `accepted_comment_id` to `posts` with a self-consistent reference; and indexes `comments(post_id)`, `archive_sources(entry_id)`, and `archive_sources(source_post_id)`.
- [x] Add the migration and the SQLx repositories. Comment reads carry the parent discussion's visibility predicate; accepting is scoped to the owning discussion in SQL.
- [x] Extend `crates/db/tests/repositories.rs` (DATABASE_URL-gated) for reply insert and listing, accepted-answer set/replace/clear, cross-discussion accept rejection, source insert plus both lookup directions, the derived `reply_count`, compare-and-swap on a stale status, the duplicate-source conflict, and that hiding a source drops it from the entry's backlink. Verified against a disposable PostgreSQL 16 container, which also proved the widened CHECK constraint actually admits `archived` — the anonymous constraint name was a guess whose failure mode is silent.
- [x] Run `cargo test -p campus_agora_db` with and without `DATABASE_URL`.

### Task 6: API Resource And Contract

- [x] Write failing tests in `crates/api/tests/discussion.rs`: create requires auth; list and detail follow the archive visibility rules and return 404 for an invisible discussion; reply requires auth and returns 201; accept enforces permission (403 for a stranger) and 404 across discussions; status change to `archived` follows the state machine and returns 409 otherwise; promote returns 201 with the new draft entry and its source; `GET /api/v1/knowledge-entries/{id}/sources` lists them; a malformed id is 400.
- [x] Implement `crates/api/src/discussion.rs`, wire the routes, and extend the contract with every status each handler returns, including 500. Optional-auth reads use `security: [{}, {"bearerAuth": []}]`, matching the rule M2's review established. **Not as planned:** `openapi_document()` hit `serde_json::json!`'s recursion limit, so the M3 fragment lives in `crates/api/src/openapi_m3.rs` and is merged in.
- [x] Extend `crates/api/tests/openapi.rs`.
- [x] Run `cargo test -p campus_agora_api` green.

### Task 7: Contract, Client, Mock

- [x] Run `bun run api:types`; commit the regenerated artifacts. The generator needed a fix first: it threw on OpenAPI 3.1's `type: ["string", "null"]`, and dropping the null would have told the frontend a nullable field is always present.
- [x] Write failing Bun tests covering the discussion client methods and, per the mock-parity rule, the cases where the mock must refuse what the server refuses: unauthenticated reply, stranger accepting, cross-discussion accept, illegal archive transition, and the enum and length validations.
- [x] Implement `packages/api-client/src/discussion.ts`, extend the client, the mock, and `index.ts`. Also updated `apps/web` where TypeScript's exhaustive `Record<ModerationStatus, T>` maps caught the new status: badge label and tone (plus a `badge-info` rule and a test that catches a composed variant class with no CSS), status labels, and the transition table.
- [x] Run `bun --cwd packages/api-client test` and `bun run typecheck` green.

### Task 8: Docs And Verification

- [x] Update `docs/architecture/auth-permissions.md` (new actions, the `Archived` state, and why deletion stays a soft-delete rather than a status), `docs/architecture/api-contracts.md` (new endpoints and error codes), and `docs/product/privacy.md` (comments and source links in the data inventory, including that a promoted reply keeps its author attribution).
- [x] Run the full gate set: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` against dockerized PostgreSQL 16, `bun run api:check`, `bun run typecheck`, `bun run lint`, `bun run lint:styles`, `bun run test`, `bun run build`, `bun run ci:docs`, `git diff --check`.
- [x] Move M3.1 facts into `docs/ai-log/done.md`. Every box above is ticked against work that exists; where the delivered shape differs from the plan, the step says so rather than being quietly ticked.
- [x] Commit in reviewable increments.
