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

### 2026-07-26 - Implement M2.2 archive frontend flows

- Source: `docs/product/milestones.md` M2, second delivery phase.
- Milestone: M2.
- Status: open.
- Acceptance: `components/ui` gains the primitives the archive flows need
  (Input, Textarea, Select, Card, Badge, EmptyState, LoadingState), and the web
  app gains archive list, detail, and editor flows built from them, with no
  page-local one-off styling. M2 reaches its exit criteria only when this
  lands alongside M2.1.
- Dependencies: M2.1 backend (this branch).
- Notes: `apps/web/src/components/ui` currently holds only `Button.tsx`, which
  is why M2 was split.

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
