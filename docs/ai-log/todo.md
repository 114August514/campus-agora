# AI Log Todo

This file records meaningful pending work for AI agents and collaborators.
Keep entries short, dated, and actionable.

## Entry Format

```md
### YYYY-MM-DD - Task Title

- Source:
- Milestone:
- Status:
- Acceptance:
- Dependencies:
- Notes:
```

## Pending

### 2026-07-26 - Close the remaining M2 frontend test gaps

- Source: M2 self-review. Several M2.2 plan checkboxes were ticked ahead of the
  evidence; the plan has been annotated and the gaps listed here.
- Milestone: M2.
- Status: open.
- Acceptance: frontend tests cover the archive list's error-with-retry path and
  its page reset on filter change; the detail hook's file/resolve refresh cycle;
  and the editor's server-422 surfacing, create-then-navigate, edit-mode value
  loading, and in-flight submission blocking.
- Dependencies: none.
- Notes: the underlying behaviors are covered at the application and API layers
  (`crates/application/tests/archive_service.rs`, `crates/api/tests/archive.rs`),
  so this is frontend wiring coverage rather than unverified behavior.

### 2026-07-26 - Debounce archive list filters

- Source: M2 self-review. `ArchiveListPage` calls `setFilter` on every
  keystroke, so typing a four-character query pushes four history entries,
  fires four requests, and blanks the results to a loading state each time.
- Milestone: M3.
- Status: open.
- Acceptance: text filters are debounced, the query string is replaced rather
  than pushed, and the previous page stays rendered during a refetch.
- Dependencies: none.
- Notes: `docs/engineering/quality.md` lists "avoid repeated network requests"
  in the performance budget.

### 2026-07-26 - Replace Button-inside-Link with a single control

- Source: M2 self-review. Eight places render a `<Button>` inside a `<Link>`,
  which is invalid HTML: it creates two tab stops for one action and screen
  readers announce "link, button".
- Milestone: M3.
- Status: open.
- Acceptance: a link-styled `Link`, or a `Button` that navigates, so each
  action is one control.
- Dependencies: none.

### 2026-07-26 - Use a keyed digest for campus identity subjects before M6

- Source: M1 security review. `hash_provider_subject` is unsalted SHA-256,
  which is fine for the mock personas' public constant subjects but reversible
  by enumeration for real student identifiers.
- Milestone: M6.
- Status: open.
- Acceptance: subjects hashed with HMAC-SHA256 using a rotatable pepper from
  the secret manager, with the rotation story documented in
  `docs/product/privacy.md`.
- Dependencies: secret management for the real campus provider.
- Notes: session tokens keep plain SHA-256; they are 256-bit CSPRNG output, so
  enumeration is infeasible there.

### 2026-07-26 - Rate limit login and purge stale sessions

- Source: M1 security review. `POST /api/v1/auth/mock-login` is unauthenticated
  and writes a session row plus an audit row per request, with no rate limit,
  no per-user session cap, and no purge job.
- Milestone: M7.
- Status: open.
- Acceptance: login is rate limited, and expired sessions are purged on a
  schedule as promised in `docs/product/privacy.md`.
- Dependencies: the rate-limiting middleware boundary described in
  `docs/operations/security.md`.
- Notes: `sessions_expires_at_idx` was added in the M1 migration to support the
  purge.
