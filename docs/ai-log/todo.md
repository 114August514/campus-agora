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

### 2026-07-26 - Build the permission policy call seam in M2

- Source: M1 review finding. `decide`/`is_allowed`/`AuthenticatedActor` have no
  callers outside `crates/domain`, and nothing constructs an `Actor` from a
  session, so the resource-context flags have never been proven derivable.
- Milestone: M2.
- Status: open.
- Acceptance: the first protected archive endpoint builds an `Actor` from the
  session plus resource context and calls `is_allowed`, with allow, deny, and
  not-found tests.
- Dependencies: M2 archive resources.
- Notes: `CurrentUser` currently carries only a flat membership list;
  `is_resource_author` and `is_assigned_maintainer` need resource lookups.

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
