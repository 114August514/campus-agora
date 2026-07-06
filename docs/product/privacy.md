# Privacy And Data Boundaries

Campus Agora handles campus community content. Privacy rules must be explicit
before real identity integration, attachments, or AI assistance are added.

## Data Inventory

| Data | Purpose | Storage | Access |
| --- | --- | --- | --- |
| Account profile | Identify authenticated users and display ownership | PostgreSQL | User, moderators, admins |
| Campus identity reference | Link account to campus auth provider | PostgreSQL | Auth service, admins |
| Discussion content | Community discussion and later archive source | PostgreSQL | Readers based on visibility |
| Archive content | Durable knowledge entries | PostgreSQL | Readers based on visibility |
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

## Retention

Default retention targets:

- User-authored content: retained while visible or recoverable.
- Soft-deleted content: retained until policy-driven purge is approved.
- Audit events: retained longer than content because they explain risk actions.
- Request logs: short operational retention, enough for debugging and abuse
  response.
- Backups: retained by environment policy and purged on schedule.
- Attachments and AI outputs: retention must be defined before the feature is
  implemented.

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
