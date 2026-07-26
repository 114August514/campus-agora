# Privacy And Data Boundaries

Last updated: 2026-07-26

Campus Agora handles campus community content. Privacy rules must be explicit
before real identity integration, attachments, or AI assistance are added.

## Data Inventory

| Data | Purpose | Storage | Access |
| --- | --- | --- | --- |
| Account profile | Identify authenticated users and display ownership | PostgreSQL | User, moderators, admins |
| Campus identity reference | Link account to campus auth provider; stored as a subject digest plus provider name, never as raw assertions | PostgreSQL | Auth service, admins |
| Session records | Keep authenticated sessions alive; stored as SHA-256 token hash with expiry and revocation timestamps, never the raw token | PostgreSQL | Auth service, admins |
| Organization memberships | Prove a user acts within a verified organization context | PostgreSQL | User, organization tooling, moderators, admins |
| Discussion content | Community discussion and later archive source | PostgreSQL | Readers based on visibility |
| Archive content | Durable knowledge entries, including their revision history | PostgreSQL | Readers based on visibility |
| Archive source references | Free-form provenance for an entry, which may contain third-party URLs | PostgreSQL | Readers based on visibility |
| Corrections | Reports that an entry is out of date or wrong, with the reporter's identity | PostgreSQL | Entry author, maintainers, moderators, admins |
| Moderation state | Review status and safety decisions | PostgreSQL | Moderators, admins |
| Audit events | Accountability for high-risk actions | PostgreSQL | Admins, security reviewers |
| Request logs | Debugging and abuse response | Log backend | Operators |
| Attachments | Future file support | Object storage | Permission checked at download |
| AI outputs | Future draft assistance | PostgreSQL or object storage | Authors, reviewers, admins |

## Collection Principles

- Collect the minimum data needed for campus knowledge workflows.
- Do not store raw campus SSO assertions after login exchange.
- Do not put secrets, tokens, passwords, or raw identity payloads in logs.
- Do not store real student data in seed data, mock data, tests, or AI LOG.

### Identity Digest Strength

M1 hashes provider subjects with plain SHA-256. That is sufficient for the mock
personas, whose subjects are public constants, but it is **not** a meaningful
protection for real campus identifiers: student numbers are low-entropy and
structured, so an unsalted digest over that keyspace is reversible by
enumeration against a database or backup dump.

Before M6 connects a real campus provider, subject hashing must move to a
keyed construction (HMAC-SHA256 with a rotatable server-side pepper held in the
secret manager, or a memory-hard KDF), and this section must be updated with
the rotation story. Session tokens keep plain SHA-256, which is correct there:
they are 256 bits of CSPRNG output, so enumeration is infeasible.

## Retention

Default retention targets:

| Data Category | Product Retention Boundary |
| --- | --- |
| Business content | Retained while visible, drafted, recoverable, or needed for account-visible history. |
| Session records | Valid for `SESSION_TTL_SECONDS` (default 24 hours). Expired and revoked session rows carry no usable credential because only the token hash is stored; bulk purge of stale rows must be defined before production launch. |
| Soft-deleted content | Retained until policy-driven purge is approved. |
| Audit logs | Retained longer than operational request logs because they explain risk actions. Exact production duration must be set before real auth, moderation, or admin actions launch. |
| Request logs | Short operational retention, enough for debugging and abuse response. |
| Backups | Retained by environment policy and purged on schedule. |
| Attachments | Retained no longer than the owning content unless legal, abuse-response, or safety review requires a hold. |
| AI outputs | Retained according to the source draft, archive entry, or review task they support. |

## Deletion And Export

Users should be able to request export or deletion of personal data when the
feature exists. Deletion behavior must distinguish:

- Content removal from public visibility.
- Soft deletion for recovery and moderation review.
- Hard deletion after retention and audit requirements are satisfied.
- Backup expiry, where deleted data may remain until backup rotation completes.

No user-generated content should be hard deleted without permission checks,
audit events, and recovery impact review.

## Anonymous Semantics

Future anonymous or pseudonymous posting must not mean unaccountable posting.
The UI may hide identity from normal readers, but the backend must retain enough
auditable linkage for moderation and abuse response, with access limited to
authorized reviewers.

## Third Parties

M0.2 assumes no third-party analytics, file scanning, AI provider, email
delivery, or object storage integration. Adding any third party requires a doc
update covering data sent, purpose, retention, user visibility, and failure
mode.
