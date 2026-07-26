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

### 2026-07-27 - Resolve M3 review findings

- Result: Five independent review lenses over the M3 diff produced 25 findings;
  20 were refuted by an adversarial pass, 5 survived, and 2 refutations were
  overridden on my own judgement. All are fixed. M3 stays 评审中.
- Changed:
  - Mock parity. The mock skipped every text and tag bound the server enforces:
    verified that 11 tags, a 300-character title, a 250-character promoted
    title and a 101-character search term all returned 201/200 where the server
    returns 422, and that duplicate tags were stored undeduped. The bounds now
    live in one `LIMITS` table with `boundedText`/`boundedSummary` helpers that
    every branch calls.
  - Reply promotion truncates the derived title. A thread titled at or near the
    200-character limit produced an over-long entry title and a 422 the reader
    could not act on, so the promote button was permanently dead for it.
  - The contract declares 422 on `listDiscussions`, and the OpenAPI test now
    pins the exact status set per operation instead of only asserting 500.
  - The provenance card names the quoted author instead of printing their UUID;
    the name is carried through the ports, both stores, the DTO, the contract
    and the mock, and asserted against a real database.
  - Added the failed-reply test the M3.2 plan ticked without writing.
- Verification: full gate set with a disposable PostgreSQL 16 container. Rust
  166, apps/web 65, api-client 59. Every finding was reproduced before it was
  fixed — the mock divergences with a probe against both implementations, the
  contract gap with a throwaway integration test, and the new failed-reply test
  was mutation-checked by inverting the guard it covers.
- Decisions:
  - The mock/server divergence is a recurring class, not a bug: three
    milestones, three occurrences, each time because a new handler
    re-implemented validation by hand. The fix is the shared table, not the
    five individual bounds.
  - Overrode the refutation of "the provenance card prints a raw UUID". The
    refuter was right that it is not a privacy leak — the id is already in the
    same payload — and right that the review brief excluded style. But
    `docs/product/privacy.md` makes preserving the quoted author's identity a
    requirement, and a UUID satisfies it in the database while satisfying
    nothing for a reader. The feature did not do what it existed to do.
  - Overrode the refutation of "M3.2 Task 3 ticks a test that does not exist".
    The refuter downgraded it because the code is correct. The code being
    correct is not the point: an unwritten test ticked as written is exactly
    what made M2 walk back its completion claim, and Task 3 carried no
    "Not covered" clause.
  - Accepted 20 refutations, including the promotion race (an attacker gains no
    capability they do not already have through `create_draft`), the missing
    ceiling on derived entries (bounded by the unique constraint), and the
    absence of a transaction around promotion (the failure modes are a
    recoverable orphan draft, not a disclosure).
- Follow-up: none new. The pre-existing todo entries stand.

### 2026-07-26 - Deliver M3.2 discussion frontend and close the loop in the UI

- Result: The discussion-to-archive loop has a face. M3's three exit criteria
  are met; the milestone is 评审中 rather than 已完成 because the claim should
  follow review, not precede it.
- Changed:
  - Routes and navigation. A `/discussions` namespace, path builders, and the
    讨论 nav entry pointing at a real page instead of home.
  - `features/discussion`: `useDiscussionList` and `useDiscussion` (both on the
    request-sequence-number pattern), plus labels that word each moderation
    state for a *thread* rather than reusing the archive's wording.
  - Pages: discussion list, detail, and create. The detail page carries the
    reply box, the accept-answer control, the status transitions, the promote
    actions, and the derived-entry list.
  - `ArchiveDetailPage` gained the 内容来源 section, and `useArchiveEntry` now
    loads sources with the entry.
  - `ButtonLink`, replacing `Button`-inside-`Link` in eight existing places
    plus the four this milestone would have added.
  - `ui.test.tsx` gained `afterEach(cleanup)`.
- Verification: `cargo fmt --all --check`, `cargo clippy --workspace
  --all-targets -- -D warnings`, `cargo test --workspace` against a disposable
  PostgreSQL 16 container, `bun run api:check`, `typecheck`, `lint`,
  `lint:styles`, `test` (apps/web 63, api-client 52), `build`, `ci:docs`,
  `git diff --check`.
- Decisions:
  - The distinction between the two content kinds is structural, not
    decorative: separate route namespaces, separate pages, and different
    information. A discussion shows reply count, accepted answer, and last
    activity; an entry shows version, audience, provenance, and corrections.
  - Promotion lands in the archive editor. It creates a draft the promoter
    owns, so the useful next step is finishing it, not reading it.
  - The UI offers only what the server will accept: no reply box on a draft or
    archived thread, no promote control on a non-public one. A button that
    guarantees a 409 is worse than no button.
  - `ButtonLink` was built rather than deferred. The alternative was growing a
    known-invalid pattern from eight places to twelve and filing another todo.
- Follow-up: the frontend test gaps carried over from M2.2 (list error-retry,
  page reset on filter change, editor server-422 and in-flight blocking), and
  filter debouncing, both still open in `todo.md`.

### 2026-07-26 - Deliver M3.1 discussion-to-archive backend

- Result: Discussions, replies, an accepted-answer flow, and a traceable path
  from a discussion into an archive entry, through domain, application,
  database, HTTP, contract, and mock. M3 is 进行中, not 已完成: the exit
  criterion "UI distinguishes discussion content from durable archive content"
  belongs to M3.2.
- Changed:
  - Domain. `ModerationStatus::Archived`, the transitions around it, comment
    validation, and `ReplyToDiscussion` / `AcceptAnswer` / `PromoteToArchive` /
    `ArchiveContent` in the permission matrix.
  - Application. `DiscussionService`, discussion/comment/source ports, their
    in-memory implementations, and `ArchiveService::list_sources`. Status
    transitions now resolve to an action through one shared function so
    entries and discussions answer the same question the same way.
  - Database. `20260728000000_m3_discussion_loop.sql` adds `comments`,
    `archive_sources`, `posts.accepted_comment_id`, and widens the moderation
    CHECK constraint. The visibility predicate became a function taking the
    post kind, and derives its public-status list from the domain.
  - API. `/api/v1/discussions` with status, replies, accepted-answer,
    promotions, and derived-entries sub-resources, plus
    `/api/v1/knowledge-entries/{id}/sources`. The OpenAPI document is now
    assembled from per-milestone fragments.
  - Client. `packages/api-client/src/discussion.ts`, the generator's support
    for OpenAPI 3.1 nullable unions, and the mock's discussion routes.
  - Frontend. The places TypeScript's exhaustive `Record<ModerationStatus, T>`
    maps flagged: badge label and tone, status labels, transition table, plus a
    `badge-info` rule and a test for composed variant classes.
- Verification: `cargo fmt --all --check`, `cargo clippy --workspace
  --all-targets -- -D warnings`, `cargo test --workspace` (165 passing against
  a disposable PostgreSQL 16 container), `bun run api:check`, `typecheck`,
  `lint`, `lint:styles`, `test` (apps/web 39, api-client 52), `build`,
  `ci:docs`, `git diff --check`. Every authorization and disclosure rule was
  proven with a failing test before it was implemented.
- Decisions:
  - `archived` is publicly readable. An archive entry links back to the
    discussion it came from and that link has to resolve; hiding content is
    what `hidden` does. `archived → hidden` exists so archiving cannot put
    content beyond moderation reach.
  - `deleted` stays a soft delete rather than becoming a status, because the
    data-governance rules require recoverable deletion with an audit event and
    an accountable actor.
  - Promotion accepts only publicly readable sources. Being *able to see* a
    draft or hidden thread is not enough — otherwise publishing the entry would
    republish content that was deliberately not public, which is the M2
    revision-1 disclosure shape.
  - Both directions of the source link are visibility-scoped, so a backlink
    cannot disclose a title or enumerate other people's drafts.
  - Comment ids resolve only inside their own discussion, in the service and
    again in the SQL statement — the M2 IDOR shape, closed up front.
- Follow-up: M3.2. The `Conditional` cell on `Publish archive entry` for
  `OrganizationMember` is still unresolved (M4+).

### 2026-07-26 - Resolve M2 review findings

- Result: Fixed the defects three independent reviews found in M2 (general
  code, security, contract/documentation), and corrected an over-claimed
  milestone status.
- Changed:
  - Authorization. `resolve_correction` authorized against the entry in the
    path but acted on the correction id alone, so any student who authored any
    entry could close a correction belonging to another entry — and the
    response disclosed its message and reporter for an entry they could not
    see. `CorrectionRepository::resolve` now takes the owning entry and both
    stores filter on it.
  - Disclosure. Revision 1 was written at creation while draft edits updated
    the post in place, so text removed before publishing stayed in history and
    became world-readable on publish. A draft edit now rewrites its revision.
    Edits to hidden or rejected entries gain a revision and an audit event.
  - Privacy. The corrections listing was public while `privacy.md` restricts
    reporter identities; it now requires a session and a stake in the entry.
  - Concurrency. `set_status` is compare-and-swap, so an author cannot
    overwrite a moderator's reject that lands between check and write. A
    concurrent revision collision is a 409 rather than a 500.
  - Bounds. Search terms are capped and LIKE metacharacters escaped; revisions
    and corrections are capped because both are returned whole.
  - Mock parity. The mock treated an expired token as a guest, skipped the
    permission check on status changes, discarded six of eight PATCH fields,
    and accepted input the server rejects. Frontend tests run only against the
    mock, so the editor's save path had never met real behavior.
  - Frontend. Fifteen class names had no CSS rule; entry bodies lacked
    `white-space: pre-wrap`, collapsing every paragraph break in the product's
    core content. Mock mode is now disabled in production builds. Status
    buttons show only performable transitions, a 401 on read asks for re-login
    instead of a retry, a failed correction keeps its text, and clearing an
    optional field now clears it.
  - Contract and docs. Optional-auth reads declare
    `security: [{}, {"bearerAuth": []}]` rather than `security: []`, so a
    generated client still sends the token; the unreachable 403 on create was
    dropped; the two archive action paths are recorded as naming exceptions;
    `quality.md`, `index.md`, and `deployment.md` gained freshness lines;
    `.env.example` gained `VITE_API_MOCK`; `AGENTS.md` records M2; and
    `deployment.md` records the history-fallback requirement that client-side
    routing implies.
- Verification: `cargo test --workspace` (106 tests) against a disposable
  PostgreSQL 16 container, `cargo fmt --all --check`, `cargo clippy --workspace
  --all-targets -- -D warnings`, `bun run api:check`, `bun run typecheck`,
  `bun run lint`, `bun run lint:styles`, `bun --cwd apps/web test` (38),
  `bun --cwd packages/api-client test` (39), `bun run build`,
  `bun run ci:docs`, `git diff --check`. Each authorization and disclosure fix
  landed with a test that failed first: the IDOR, the revision leak, the
  corrections listing, and the missing stylesheet rules were all demonstrated
  before being fixed.
- Decisions: M2 was marked 已完成 on test coverage that had not been written.
  Several M2.2 plan checkboxes claimed assertions the tests did not make. The
  plan is now annotated with what was actually covered, the gaps are recorded
  in `todo.md`, and M2 is back to 评审中 — the exit criteria are met, but the
  claim should follow review rather than precede it.
- Follow-up: the remaining frontend test gaps, list-filter debouncing, and the
  `Button`-inside-`Link` markup are tracked in `docs/ai-log/todo.md`.

### 2026-07-26 - Implement M2.2 archive frontend flows and close M2

- Result: Completed M2. Knowledge entries can now be created, updated,
  versioned, and corrected through the UI as well as the API, on a shared
  component system.
- Changed: `apps/web/src/styles/{tokens,themes,globals}.css` for semantic
  colour, elevation, z-index, spacing, and duration tokens; new
  `components/icons` entry point; `components/ui/{Input,Textarea,Select,Card,
  Badge,EmptyState,LoadingState,ErrorState,Pagination}.tsx` plus `Button`
  variants and a loading state; `app/routes.ts` and a router in `app/App.tsx`
  and `main.tsx`; `features/archive/{labels.ts,hooks/*}`;
  `pages/{Home,ArchiveList,ArchiveDetail,ArchiveEditor,DesignSystem,NotFound}Page.tsx`;
  `lib/api.ts` mock switch; `apps/web/tests/{tokens,ui,routes,archive}` and a
  DOM test environment; `docs/engineering/{development,quality}.md` and
  `docs/product/milestones.md`.
- Verification: `bun --cwd apps/web test` (31 tests), `bun run typecheck`,
  `bun run lint`, `bun run lint:styles`, `bun run test`, `bun run build`,
  `cargo test --workspace` against a disposable PostgreSQL 16 container,
  `bun run api:check`, `bun run ci:docs`, `git diff --check`.
- Decisions: Added `react-router-dom` and `lucide-react`. The router is not
  optional convenience: the product positions the archive as knowledge that can
  be referenced, so an entry and a filtered list both have to be linkable, and
  the canonical spec already anticipated `app/router.tsx`. Lucide was already
  mandated by the design-system rules. List filters live in the query string
  for the same linkability reason. Both archive hooks track requests by
  sequence number rather than a cancellation flag, so a slow response from a
  previous filter cannot overwrite a newer one. `LoadingState` uses `<output>`
  rather than a hand-written `role="status"`.
- Follow-up: Modal, Drawer, Dropdown, Tabs, and Toast are deliberately not
  built, because no M2 flow uses them; add each with a `/design-system` section
  and a test when a flow needs it. Two test-isolation bugs were fixed in
  passing: the session test replaced the whole `window` object, stripping
  happy-dom's DOM constructors for every later test file, and the archive tests
  cleared `innerHTML` instead of unmounting, leaving React mid-render.

### 2026-07-26 - Implement M2.1 archive backend core

- Result: Delivered the backend half of M2. Knowledge entries can be created,
  edited, listed, searched, read, versioned, and corrected through
  `/api/v1/knowledge-entries`, with visibility and permission enforced in
  backend policy.
- Changed: `crates/domain/src/archive.rs` plus archive tests and new archive
  actions in `permissions.rs`; `crates/application/src/archive/*`, archive
  ports, and in-memory implementations; `crates/db/migrations/20260727000000_m2_archive_core.sql`
  with the PostgreSQL archive repositories and DATABASE_URL-gated tests;
  `crates/api/src/archive.rs`, routes, and the OpenAPI paths and schemas;
  regenerated `contracts/openapi.json` and `packages/api-client/src/generated.ts`;
  `packages/api-client/src/archive.ts`, client wiring, and mock parity; docs
  for the permission matrix, error codes, pagination, visibility, endpoint
  lists, and the privacy inventory.
- Verification: `cargo test --workspace` (100 tests) against a disposable
  PostgreSQL 16 container, `cargo fmt --all --check`, `cargo clippy --workspace
  --all-targets -- -D warnings`, `bun run api:check`, `bun run typecheck`,
  `bun run lint`, `bun run lint:styles`, `bun run test`, `bun run build`,
  `bun run ci:docs`, `git diff --check`. The repository test proves the SQL
  visibility predicate against a real database: a draft is invisible to the
  public and to unrelated users, visible to its author, to an assigned
  maintainer, and to moderation scope.
- Decisions: Archive entries extend the existing `posts` spine rather than
  forking a second table, so discussion (M3) keeps the same schema, revisions,
  and moderation vocabulary. The visibility predicate lives in SQL, so an entry
  the caller may not see is never fetched. Editing a published entry writes a
  revision inside the same transaction as the content update; editing a draft
  updates in place because a draft has no published history. `ArchiveService`
  is the permission matrix's first real consumer, closing the M1 follow-up: it
  builds a domain `Actor` from the session plus entry context. The Publish
  row's `Author` cell moved from `Conditional` to `Allow`, defined as "an
  author may publish their own draft"; the `OrganizationMember` cell stays
  `Conditional` because organization-scoped entries are not modelled yet.
- Follow-up: M2.2 delivers the `components/ui` primitives and the archive
  list, detail, and editor flows; M2 reaches its exit criteria only when both
  phases land. Search stays a database `ILIKE` filter, as the milestone's
  non-goals exclude a full-text engine.

### 2026-07-26 - Resolve M1 review findings on PR #4

- Result: Fixed the defects found by three independent reviews of the M1
  branch (general code review, security review, contract/documentation
  review) before merge.
- Changed:
  - Security. `AUTH_MOCK_ENABLED` no longer fails open: `bool_env` accepted
    only exact `true`/`false`, so `AUTH_MOCK_ENABLED=0`, `False`, or a value
    with stray whitespace silently fell back to enabled, leaving an
    unauthenticated admin login reachable. It now accepts the common
    spellings and panics on anything else. The API also refuses to start
    without `DATABASE_URL` unless `AUTH_STORE_MEMORY=true` is set explicitly,
    so a missing secret can no longer route real sessions into the volatile
    in-memory store. `SESSION_TTL_SECONDS` is bounded to 30 days and parsed as
    `i64`; `ReadinessProbe` and `LoginOutcome` have hand-written `Debug` impls
    so the database password and the one-time token cannot reach a log line;
    inbound `X-Request-Id` is length- and charset-checked before it enters
    audit metadata; the 422 body no longer echoes the caller's persona.
  - Correctness. Login no longer overwrites `system_role`, which would have
    reverted admin-assigned roles on the user's next login once M4/M6 lands.
    Soft-deleted accounts can no longer log in, which previously produced a
    token whose every later request returned 401. `revoke` is idempotent in
    both stores and keeps the first revocation timestamp, so concurrent
    logouts no longer return 404 from PostgreSQL while returning 204 in
    memory. Bearer scheme matching is case-insensitive per RFC 7235.
  - Mock parity. `createCampusAgoraMockFetch` disagreed with the server in
    ways that would let frontend tests pass against behavior that does not
    exist: it never produced `403 auth_mock_disabled` (a case the web app
    already had a UI branch for), returned 422 where the server returns 400
    for malformed bodies, accepted `constructor` as a persona through the
    prototype chain, answered 200 for wrong HTTP methods, never returned 503
    for readiness failures, used non-UUID ids, and hardcoded a session expiry
    that would go stale. All are now aligned and pinned by tests.
  - Scope. Added the guarded shell listed in M1 core scope: navigation entries
    are filtered by session and role, with backend policy still the security
    boundary.
  - Tests. `apps/web` had no test runner at all, leaving the documented
    sessionStorage-only policy ungated; it now runs Bun tests covering that
    policy and navigation visibility.
  - Docs. README, `docs/index.md`, and `AGENTS.md` still announced M0.2;
    `milestones.md` had no freshness line; endpoint lists omitted the auth
    routes; `.env.example` omitted `VITE_API_BASE_URL` and `AUTH_STORE_MEMORY`;
    `api-contracts.md` gained an error-code table, the auth path-convention
    exception, and a mock-parity rule; `privacy.md` no longer overstates
    unsalted SHA-256 and records the keyed-hash requirement for M6;
    `auth-permissions.md` documents that matrix columns combine as a union of
    grants, so a `Deny` cell never revokes; `security.md` mirrors the session
    retention row.
- Verification: `cargo test --workspace` (54 tests) against a disposable
  PostgreSQL 16 container, `cargo fmt --all --check`, `cargo clippy
  --workspace --all-targets -- -D warnings`, `bun run api:types`,
  `bun run typecheck`, `bun run lint`, `bun run lint:styles`, `bun run test`,
  `bun run build`, `bun run ci:docs`, `git diff --check`. Confirmed at runtime
  that `AUTH_MOCK_ENABLED=0` now reports `authMockEnabled: false` and answers
  `403 auth_mock_disabled` where it previously issued an admin token, and that
  the API refuses to start without `DATABASE_URL`. Mutation-tested the new
  frontend guard: swapping `sessionStorage` for `localStorage` fails two tests.
- Decisions: Kept the permission fold as a union of grants rather than giving
  `Deny` cells precedence. Precedence would break "Edit own draft", where a
  Student is denied by their system-role column and allowed by the `Author`
  column, which is the intended outcome. The union rule is now documented and
  pinned by a test instead of changed.
- Follow-up: The permission policy still has no call site, because M1 ships no
  protected business resource; M2 must build the `Actor` construction seam and
  validate that the resource-context flags are derivable. Rate limiting for
  the unauthenticated login endpoint and a stale-session purge job remain open
  for M7. Subject hashing must move to a keyed construction before M6.

### 2026-07-26 - Implement M1 identity, permissions, and auth shell

- Result: Delivered the M1 milestone: permission matrix policy functions, an
  auth provider abstraction with a mock campus provider, user/organization/
  session persistence, `/api/v1/auth/*` endpoints, an auth-aware API client,
  and a frontend login-state shell.
- Changed: `crates/domain/src/{ids,roles,users,permissions}.rs` plus tests;
  `crates/application/src/{errors,ports,memory}.rs` and `auth/*` plus tests;
  `crates/db/migrations/20260726000000_m1_identity_sessions.sql`,
  `crates/db/src/{pool,repositories}.rs`, `crates/db/tests/repositories.rs`;
  `crates/api/src/auth.rs`, auth wiring and OpenAPI in `crates/api/src/lib.rs`,
  `crates/api/tests/auth.rs`; regenerated `contracts/openapi.json` and
  `packages/api-client/src/generated.ts`; `packages/api-client/src/auth.ts`
  with request/mock/index updates; `apps/web/src/features/auth/*`,
  `apps/web/src/lib/*`, App shell and styles; auth/backend/api-contract,
  privacy, milestone docs and `.env.example`.
- Verification: `cargo test --workspace` (42 tests), `cargo fmt --all --check`,
  `cargo clippy --workspace --all-targets -- -D warnings`, `bun run api:types`,
  `bun run typecheck`, `bun run lint`, `bun run lint:styles`, `bun run test`,
  `bun run build`, `bun run ci:docs`, `git diff --check`. Against a disposable
  PostgreSQL 16 container: `cargo test -p campus_agora_db` with `DATABASE_URL`
  set (repository test executed, not skipped) plus an end-to-end HTTP smoke run
  of login, session, logout, 401 and 422 paths. Confirmed by SQL that sessions
  store only a 64-char SHA-256 hash that differs from the issued token, that
  `provider_subject_hash` does not contain the raw subject, and that
  `auth.login`/`auth.logout` audit rows carry provider and request id but no
  token. A deliberate mutation removing the session expiry/revocation check was
  caught by three tests, confirming the suite is not vacuous.
- Decisions: Sessions use opaque 256-bit tokens hashed with SHA-256 at rest,
  bearer transport, `SESSION_TTL_SECONDS` expiry and explicit revocation;
  clients keep tokens in tab-scoped `sessionStorage`, never `localStorage`.
  Permission-matrix cells whose extra requirements belong to later milestones
  return a `Conditional` decision that `is_allowed` denies. The auth runtime
  uses PostgreSQL when `DATABASE_URL` is set and an in-memory store otherwise,
  logging a warning; the in-memory store is for local development and tests
  only. Kept runtime SQLx queries instead of query macros, so no `.sqlx/`
  offline metadata is required; the migration test loads the migration
  directory at runtime rather than through `sqlx::migrate!`.
  `packages/api-client` now resolves through its TypeScript source rather than
  `dist/`, because CI runs `typecheck` before `build`.
- Follow-up: `./scripts/ci/desktop.sh` could not run inside the nested worktree,
  because the parent repository workspace claims `apps/desktop/src-tauri` and
  its `exclude` entry resolves to the main checkout path only. The CI desktop
  job passed on PR #4, confirming this was an environment limitation rather
  than a code defect. Publishing, moderation, and export actions remain
  `Conditional` or unimplemented until M2 and later milestones bind the
  resource state they need.

### 2026-07-06 - 明确工具目录和文档时效规则

- Result: 新增 `tools/README.md`，并在 `AGENTS.md` 中明确长期文档的更新时间规则。
- Changed: `tools/README.md`, `AGENTS.md`, `docs/ai-log/done.md`。
- Verification: `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run ci:docs`, `git diff --check` 和工作区状态检查。
- Decisions: 使用 `README.md` 作为工具目录说明文件；长期文档在实质更新时维护 `Last updated: YYYY-MM-DD`。
- Follow-up: 后续移动工具配置或更新决策性文档时，同步更新时间并核对代码、脚本和 CI。

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
