# Security

Security work starts before production. M0.2 records the boundaries that future
features must satisfy.

## Secrets

Secrets include:

- Database credentials.
- Auth provider client secrets.
- Cookie signing keys.
- API tokens.
- Object storage credentials.
- Tauri signing keys.

Rules:

- Store secrets in deployment secret managers or GitHub Actions secrets.
- Do not commit secrets, private callback URLs, raw tokens, or dumps.
- Rotate a secret after suspected exposure.
- Document local placeholder values in `.env.example` only when they are safe.

## Rate Limiting And Abuse

M0.2 does not implement rate limiting. Before public write endpoints launch,
define limits for:

- Login attempts.
- Content creation.
- Comment/reply creation.
- Search.
- File upload and download signing.
- Admin or moderation actions.

Rate limits do not replace permission checks.

## Upload And Download Safety

Attachments are out of scope for M0.2. Before implementation, define:

- Maximum file size.
- Allowed MIME types and extensions.
- Object key naming.
- Virus or malware scanning strategy.
- Permission check at download time.
- Short-lived signed URL policy.
- Deletion and retention behavior.
- Copyright and privacy response process.

User uploads must not become public-by-default files.

## Tauri Security

Desktop permissions must stay minimal:

- No shell command access without a documented feature need.
- No arbitrary file system access in initialization milestones.
- No long-lived token in WebView localStorage.
- No unsigned auto-update process.

Capability changes must update `docs/architecture/desktop.md`.

## Audit And Data Protection

High-risk actions require audit events:

- Role and permission changes.
- Content delete and restore.
- Moderation state change.
- Data export.
- System config change.
- Security response.

Audit events should record who acted, what changed, when it changed, and the
target resource. They must not record raw secrets or raw identity assertions.

## Retention

Retention defaults are documented here and mirrored in
`docs/product/privacy.md`. Security changes that alter content retention, log
retention, backup retention, audit retention, or attachment retention must
update both privacy and operations docs.

| Data Category | M0.2 Retention Boundary |
| --- | --- |
| Business content | Retain while published, drafted, or needed for account-visible history. Soft deletion must precede hard purge when restore or audit review is required. |
| Audit logs | Retain longer than operational request logs. Exact production duration must be set before real auth, moderation, or admin actions launch. |
| Request logs | Keep for a short debugging and abuse-response window. Logs must include request IDs but avoid raw tokens, cookies, and raw campus identity assertions. |
| Backups | Define per environment before deployment. Backups need owner, rotation, restore test cadence, and deletion behavior. |
| Attachments | Retain no longer than the owning content unless legal, abuse-response, or safety review requires a hold. Object lifecycle rules must match product deletion semantics. |
| AI generated output | Retain according to the source draft, archive entry, or review task it supports. AI output must remain review-visible when it influences published knowledge. |

Exact day counts are a production policy decision. They must be added before
collecting real campus identity data, accepting uploads, or enabling public
write workflows.
