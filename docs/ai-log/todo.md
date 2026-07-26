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

### 2026-07-26 - Implement M2.1 archive backend core

- Source: `docs/product/milestones.md` M2, delivered in two phases.
- Milestone: M2.
- Status: in progress.
- Acceptance: knowledge entries can be created, edited, listed, read,
  versioned, and corrected through `/api/v1/knowledge-entries`; visibility and
  permission checks are enforced in backend policy; the contract and generated
  types cover the workflow.
- Dependencies: M1 auth session (PR #4).
- Notes: plan at
  `docs/superpowers/plans/2026-07-26-m2-1-archive-backend-core.md`. This also
  closes the M1 follow-up that left `decide`/`is_allowed` without a call seam:
  `ArchiveService` builds an `Actor` from the session plus entry context and is
  the policy's first real consumer.

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
