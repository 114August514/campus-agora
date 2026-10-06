# Security

Last updated: 2026-10-04

The current demo supports bounded public discovery and private browser-local
explorations. Controls for identity, shared content, uploads and moderation
below apply when those server-side capabilities are adopted; they do not
create current community or desktop tasks.

## Public Discovery Boundary

The discovery endpoint accepts public interest terms, not a URL to proxy.
Queries are sent to the fixed DuckDuckGo HTML search endpoint. Retrieved page
hosts must fall under `edu.cn`, `ac.cn`, `cas.cn`, `edu`, `edu.hk`, `ac.uk`, or
`edu.sg`, or equal one of the checked academic hosts `tqchen.com`,
`xiangwang1223.github.io`, `xiongyingfei.github.io`, and `cse.ust.hk`. A permitted
hostname is a reading boundary, not an endorsement of its claims.

Every redirect is checked again. HTTP(S) only, allowed ports 80/443, and no URL
credentials are accepted. Resolved private, loopback, link-local and other
blocked addresses are rejected; accepted addresses are pinned for the actual
connection, with environment proxies disabled. When local DNS returns only
synthetic `198.18.0.0/15` addresses, the service asks the fixed HTTPS endpoint
`https://dns.google/resolve` for public A records of the already-allowed host.
Returned addresses must pass the same public-address checks and are pinned;
the synthetic/private addresses are never page-fetch destinations. Other
private DNS answers remain blocked.

There are two concurrent discovery permits per process, at most five fetched
search-result pages, a 1,000,000-byte page cap, and a 14-second bound per
search/page operation. On search failure, the only fallback is live reading
of Stanford AI Laboratory and CMU Machine Learning public faculty directories,
with the changed scope and any failures shown in the response. These demo
bounds are not per-user/IP rate limiting or a production traffic policy.

Only static UTF-8 HTML is processed; no webpage code or instructions are
executed, and PDF, login-only and JavaScript-rendered content are unsupported.
The service uses no model or paid API key. It does not store private reasons,
topics or fetched pages in the backend. Public query terms may reach the
search provider, and lookup hostnames may reach `dns.google`; see
[Privacy](../product/privacy.md).

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

The demo implements the concurrency bounds above, not general rate limiting.
Before public write endpoints launch,
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

This list concerns server-side shared/account data. Deleting a private topic
or candidate from the current browser's saved explorations removes that local
record without server audit, soft deletion, export or undo. It does not remove
the source website or records saved in another topic/browser.

Audit events should record who acted, what changed, when it changed, and the
target resource. They must not record raw secrets or raw identity assertions.

## Retention

Retention defaults are documented here and mirrored in
`docs/product/privacy.md`. Security changes that alter content retention, log
retention, backup retention, audit retention, or attachment retention must
update both privacy and operations docs.

| Data Category | Retention Boundary |
| --- | --- |
| Current browser-local explorations | Retain in this browser/site's localStorage until the user removes them or browser storage is cleared. No backend copy, synchronization, export or undo is implemented. |
| Business content | Retain while published, drafted, or needed for account-visible history. Soft deletion must precede hard purge when restore or audit review is required. |
| Audit logs | Retain longer than operational request logs. Exact production duration must be set before real auth, moderation, or admin actions launch. |
| Request logs | Keep for a short debugging and abuse-response window. Logs must include request IDs but avoid raw tokens, cookies, and raw campus identity assertions. |
| Backups | Define per environment before deployment. Backups need owner, rotation, restore test cadence, and deletion behavior. |
| Attachments | Retain no longer than the owning content unless legal, abuse-response, or safety review requires a hold. Object lifecycle rules must match product deletion semantics. |
| AI generated output | Retain according to the source draft, archive entry, or review task it supports. AI output must remain review-visible when it influences published knowledge. |

Exact day counts are a production policy decision. They must be added before
collecting real campus identity data, accepting uploads, or enabling public
write workflows.
