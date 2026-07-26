# M4.1 Moderation And AI Drafting Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver the backend half of M4: a moderation queue fed by abuse reports and review submissions, audit events for every moderation action, and an AI archive-drafting interface whose output is source-backed, editable, and incapable of publishing itself.

**Architecture:** Reports and the queue extend the existing `posts`/`audit_events` spine. AI drafting follows M1's `MockCampusAuthProvider` precedent exactly — a port with a deterministic in-process implementation — and reuses M3's `archive_sources` for traceability rather than inventing a parallel provenance mechanism.

**Tech Stack:** Rust/Axum/SQLx/PostgreSQL, the M1 session layer, the M2 archive layer, the M3 discussion and provenance layers.

---

## Why M4 Is Split

Same precedent as M0, M2, and M3: the backend closes the governance loop, the frontend makes it operable. M4 reaches its exit criteria only when both land, and the milestone is not marked complete until then.

- **M4.1 (this plan):** reports, the queue, review states, audit coverage, the drafting port and its deterministic provider, contract, client, mock.
- **M4.2 (follow-up plan):** the moderation queue UI, the report flow, and the AI-draft review surface.

## Three Decisions That Shape Everything Else

**Revised during implementation.** The plan said a report would move published
content into `pending_review`. Writing the test for it exposed why that is
wrong: reporting would hand every authenticated user a takedown control, and
because the content then becomes invisible to everyone but its author, the
first report would also be the last — nobody else could corroborate or dispute
it. Reporting now changes no status at all. Content is queued; a moderator
decides. `pending_review` keeps only its author-submission entrance.

**1. Review is opt-in and report-driven, not mandatory.** The original spec lists `PendingReview`, which M2 and M3 never implemented. Making every publish require review would reverse a rule M2 and M3 already established and pinned with tests — an author may publish their own draft — and would turn a campus wiki into a moderated-first forum. That is a product change, not a milestone. So `pending_review` has exactly two entrances:

- An author *chooses* to submit a draft for review instead of publishing it.
- A report on published content moves it into the queue for a moderator to judge.

Direct author publishing survives untouched. `docs/product/milestones.md` says runtime behaviour must not exceed the current milestone; silently making everything moderated would do exactly that.

**2. Reports are not corrections.** M2 already has corrections: "this entry is out of date or wrong". A report is "this content breaks the rules" — a different actor, a different urgency, a different audience, and a different retention story. Overloading corrections would put a harassment report in the same list the entry's own author resolves, which is precisely the person a report may be *about*. They stay separate tables with separate permissions, and `docs/product/privacy.md` gains a row saying so.

**3. AI output is a draft with recorded sources, and nothing else.** The exit criterion is that AI output cannot reach publication without human action. Rather than adding a bypass and then guarding it, the provider is given no path to publish at all: it returns text, the service writes an ordinary `draft` archive entry owned by the requesting human, and records every discussion and reply it drew from in `archive_sources`. Publishing then runs the existing human path with the existing permission checks. There is no AI-publish code to review, because there is none to write.

No external provider is contacted. The milestone lists that as a non-goal until the privacy and security docs cover what would be sent, and this plan does not update them to permit it — it documents the boundary instead.

## Boundaries

In scope: abuse reports with categories, a moderation queue ordered by risk, `pending_review` and its transitions, audit events on every moderation action, reviewer visibility into reported content, the drafting port, a deterministic provider, AI-assisted drafting from a discussion, and the provenance that makes it traceable.

Not in scope (M4 非目标): automated publishing, unsourced AI output, real trust-and-safety automation, any third-party provider call, and rate limiting (logged for M7).

Further decisions:

- **Risk level is derived, not stored as opinion.** A queue item's risk comes from the highest-severity category among its open reports, computed by a pure domain function. No heuristics, no scoring model — that is the "trust and safety automation" non-goal.
- **A reporter's identity is visible to moderators only.** Same rule corrections already follow, for the same reason, and the same 404-not-403 treatment for content the caller cannot see.
- **Reporting is bounded.** One open report per (reporter, content) pair, enforced by a unique index, so a report button cannot be used to flood the queue.
- **The queue is moderator-only and paginated.** It reads across visibility scopes by definition, so it is the one listing that uses `VisibilityScope::Full`, and its permission check is `ChangeModerationState`.

## File Structure

- Modify `crates/domain/src/archive.rs`: `ModerationStatus::PendingReview` and its transitions.
- Create `crates/domain/src/moderation.rs`: `ReportCategory`, `RiskLevel`, `risk_for`, report-message validation.
- Modify `crates/domain/src/permissions.rs`: `ReportContent`, `ReviewReports`.
- Add `crates/domain/tests/moderation.rs`.
- Create `crates/application/src/moderation/{mod,service}.rs` and `crates/application/src/ai/{mod,provider,service}.rs`.
- Modify `crates/application/src/ports.rs`, `memory.rs`.
- Create `crates/db/migrations/20260729000000_m4_moderation_reports.sql`; modify `crates/db/src/repositories.rs`; extend `crates/db/tests/{migrations,repositories}.rs`.
- Create `crates/api/src/{moderation,ai}.rs` and `crates/api/src/openapi_m4.rs`; modify `crates/api/src/lib.rs`; add `crates/api/tests/moderation.rs`.
- Regenerate contract and client; create `packages/api-client/src/moderation.ts`; extend `mock.ts` and its tests.
- Modify `docs/architecture/auth-permissions.md`, `docs/product/privacy.md`, `docs/operations/security.md`, `docs/architecture/api-contracts.md`, `docs/product/milestones.md`, `docs/ai-log/*`.

## Tasks

### Task 1: Plan And Milestone Registration

- [x] Save this plan; add the M4.1 todo entry.
- [x] Set M4 to 进行中 in `docs/product/milestones.md` and record the two-phase split and the three decisions above.

### Task 2: Domain — Review State, Report Categories, Risk

- [x] Write failing tests in `crates/domain/tests/moderation.rs`: `pending_review` round-trips and is **not** publicly visible; `Draft → PendingReview`, `PendingReview → Published`, `PendingReview → Rejected`, `PendingReview → Draft` are allowed; `PendingReview → Archived` and `PendingReview → Hidden` are not; `Published → PendingReview` is allowed (a report re-opens review) while `Archived → PendingReview` is not; every `ReportCategory` round-trips; `risk_for` returns the highest severity among the given categories and `RiskLevel::None` for an empty slice; report-message validation trims, bounds, and counts characters.
- [x] Implement, and confirm `ModerationStatus::ALL` still forces the SQL predicate to be re-derived.
- [x] Run `cargo test -p campus_agora_domain` green.

### Task 3: Domain — Permissions

- [x] Write failing tests in `crates/domain/tests/permissions.rs`: `ReportContent` requires only a session, because anyone affected must be able to report; `ReviewReports` is Allow for `Moderator` and `Admin` and Deny for everyone else *including* the content's `Author` — a report may be about the author, so the author must not be the one who reviews it.
- [x] Extend `Action` and the matrix; update the table in `docs/architecture/auth-permissions.md` in the same change.
- [x] Run `cargo test -p campus_agora_domain` green.

### Task 4: Application — Reports, Queue, Audit

- [x] Write failing tests in `crates/application/tests/moderation_service.rs`: a guest cannot report; reporting invisible content is `NotFound`; a second open report from the same reporter is `Conflict` while a different reporter is not; reporting works on either content kind; the queue is moderator-only and `Forbidden` even for the content's author; queue items carry the derived risk and open-report count; the queue orders by risk then age; reporter identities are moderator-only; a report cannot be resolved through an unrelated item; report messages are validated; both actions are audited; an author submitting their own draft reaches `pending_review` with no report behind it. **Two planned assertions were inverted** per the revision above: reporting leaves content published, and a second reporter can still reach it.
- [x] Implement ports, in-memory implementations behaviourally identical to PostgreSQL, and `ModerationService`.
- [x] Run `cargo test -p campus_agora_application` green.

### Task 5: Application — Drafting Port And Deterministic Provider

- [x] Write failing tests in `crates/application/tests/ai_service.rs`: the provider is deterministic — the same discussion yields the same draft twice; the draft is created as `Draft` owned by the requesting user, never `Published`; every reply the provider drew from is recorded in `archive_sources` with its own author preserved; the accepted answer, when present, is drawn from first; a draft from a non-public discussion is refused with the same rule M3 established; the entry records that it was AI-assisted and which provider produced it; requesting a draft when the capability flag is off is `Forbidden`; a guest is `Forbidden`; the request writes an audit event.
- [x] Implement `ArchiveDraftProvider` with a `DeterministicDraftProvider`, and `AiDraftService`. The provider signature returns text and source ids only — it is given no repository handle, so it *cannot* write or publish.
- [x] Run `cargo test -p campus_agora_application` green.

### Task 6: Migration And PostgreSQL Repositories

- [x] Extend `crates/db/tests/migrations.rs`: the migration creates `content_reports` (target post, reporter, category, message, soft-delete columns, resolution columns), a partial unique index making one *open* report per reporter and post, an index for the queue's ordering, and widens the moderation CHECK for `pending_review`; adds `ai_provider` provenance columns to `posts`.
- [x] Add the migration and the SQLx repositories, applying and verifying against a disposable PostgreSQL 16 container — the M3 review showed a constraint-name guess whose failure mode is silent.
- [x] Extend `crates/db/tests/repositories.rs` (DATABASE_URL-gated) for report insert, the duplicate-open-report conflict, queue ordering by risk then age, resolution, and that a resolved report frees the reporter to file again.
- [x] Run `cargo test -p campus_agora_db` with and without `DATABASE_URL`.

### Task 7: API, Contract, Client, Mock

- [x] Write failing tests in `crates/api/tests/moderation.rs`: report requires auth and returns 201 and leaves the content published; a duplicate open report is 409; reporting invisible content is 404; the queue and the per-item reports are 403 for a non-moderator including the author; resolving is 404 across items; the AI-draft endpoint is 403 when the flag is off, 201 with a draft and its sources when on, and 409 on a non-public source; malformed ids and unknown enums are 400; a blank report message is 422.
- [x] Implement the handlers, wire the routes, and add `crates/api/src/openapi_m4.rs` following the M3 fragment pattern. Extend the exhaustive status-set table in `crates/api/tests/openapi.rs` with every new operation — that table is what caught M3's missing 422.
- [x] Regenerate contract and client; implement `packages/api-client/src/moderation.ts`.
- [x] Extend the mock with the *same* rules, routing every new write through the shared `LIMITS`/`boundedText` helpers rather than re-implementing validation. Three milestones shipped a divergence because each handler validated by hand; the fourth must not.
- [x] Run `bun --cwd packages/api-client test` and `bun run typecheck` green.

### Task 8: Docs And Verification

- [x] `docs/architecture/auth-permissions.md`: the two new actions, `pending_review` and its transitions, and why an author cannot review a report about their own content.
- [x] `docs/product/privacy.md`: reports in the data inventory, reporter identity visible to moderators only, retention, and the AI-provenance columns.
- [x] `docs/operations/security.md`: what a moderation action audits, and an explicit statement that no external AI provider is contacted plus what would have to be documented first.
- [x] `docs/architecture/api-contracts.md`: new endpoints and error codes.
- [x] Run the full gate set: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` against dockerized PostgreSQL 16, `bun run api:check`, `typecheck`, `lint`, `lint:styles`, `test`, `build`, `ci:docs`, `git diff --check`.
- [x] Move M4.1 facts into `docs/ai-log/done.md`. Every box above is ticked against work that exists, and the two steps whose delivered shape differs from the plan say so rather than being quietly ticked.

**Not delivered as planned:** the migration test asserts an index named
`content_reports_open_idx` covering open reports by age rather than "an index
for the queue's ordering" — the queue sorts by derived risk in Rust, so an
index on risk is not possible and would not help.
