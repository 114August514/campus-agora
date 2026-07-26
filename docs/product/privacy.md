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
| Discussion replies | Answers and follow-ups on a discussion, with their author's identity | PostgreSQL | Readers based on the parent discussion's visibility |
| Archive content | Durable knowledge entries, including their revision history | PostgreSQL | Readers based on visibility |
| Archive source references | Free-form provenance for an entry, which may contain third-party URLs | PostgreSQL | Readers based on visibility |
| Discussion-to-archive links | Structured provenance: which discussion or reply an entry was drawn from, and who wrote the quoted text | PostgreSQL | Readers who can see both ends of the link |
| Corrections | Reports that an entry is out of date or wrong, with the reporter's identity | PostgreSQL | Entry author, maintainers, moderators, admins |
| Abuse reports | Reports that content breaks the rules, with the reporter's identity, category, and free text | PostgreSQL | Moderators and admins only |
| AI provenance | Which drafting provider composed an entry, if any | PostgreSQL | Anyone who can read the entry |
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

### Promoted Content Keeps Its Author

Promoting a reply into an archive entry copies that person's words into an
artifact someone else owns. The link records `source_author_id` — the reply's
author, not the promoter — so attribution is not lost the moment the entry is
saved. The reply is already public in its discussion, so naming its author on
the entry discloses nothing new; omitting the attribution would be the actual
harm.

Only publicly readable discussions can be promoted, so promotion can never
republish content that was deliberately not public. Both directions of the link
are filtered by the reader's own visibility: a source pointing at a discussion
they cannot see is omitted rather than exposing its title, and an entry still in
draft is not listed on the discussion it came from.

### A Report Is Not A Correction

A correction says an entry is out of date and is resolved by the people who
maintain it. A report says content breaks the rules — and may be *about* those
same people. Reporter identities on abuse reports are therefore visible to
moderators and admins only, and explicitly **not** to the content's author,
who is the person a report may accuse. The permission matrix enforces this with
`Deny` in the `Author` and `Maintainer` columns.

Filing a report changes nothing the campus can see. Content stays where it is
and enters a queue; only an explicit moderation decision changes its status.
The alternative would hand every authenticated user a takedown control and, by
hiding the content, prevent anyone else from corroborating or disputing it.

### AI Output Carries Its Provenance

An entry composed by a drafting provider records which provider produced it,
and every discussion or reply it drew from is recorded in the same source links
hand-promoted entries use. Hand-written entries leave the provider empty, which
is what makes the marker meaningful. No text is sent to any third party — see
`docs/operations/security.md`.

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
