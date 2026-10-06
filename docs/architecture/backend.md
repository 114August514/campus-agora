# Backend Architecture

Last updated: 2026-10-04

The backend is a Rust API server. Handlers should stay thin; domain and
application crates carry business rules.

## Crate Responsibilities

- `crates/domain`: entities, value objects, enums, validation, permission pure
  functions, and state transitions.
- `crates/application`: use cases, service orchestration, transaction intent,
  repository traits, and permission composition.
- `crates/db`: migrations, SQL row models, repository implementations, and
  database connection concerns.
- `crates/api`: Axum app, routes, DTOs, middleware, errors, config, health
  checks, readiness checks, and OpenAPI export.

## Current Discovery Demo

`POST /api/v1/discoveries` uses a thin Axum handler and
`crates/application/src/discovery.rs` for external collection. It requires no
database or API key. `bun run dev:api` starts the API binary; the contract
exporter remains a separate binary.

The service sends the user's public query to DuckDuckGo's HTML search index,
then reads eligible academic pages. On search transport or verification-page
failure, it instead reads and matches two fixed public directories: Stanford
AI Laboratory faculty and CMU Machine Learning core faculty. The response
identifies the actual provider and scope; this fallback searches those
directories, not the whole web or the four demonstration candidates.

Collection allows at most five search-result pages, 1,000,000 bytes per page,
and 14 seconds per search/page operation, with two concurrent discovery
requests per API process. Directory fallback reads two pages. Each request and
redirect validates the source range and resolved public addresses, then pins
the connection to those addresses. The special local `198.18.0.0/15` fake-IP
case uses a fixed `dns.google` public A-record lookup and still requires public
destination addresses; see [Security](../operations/security.md).

This implementation extracts static UTF-8 HTML text and query-matching
passages, with a small explicit Chinese/English vocabulary map. It runs no
browser JavaScript, PDF extraction, login, or model summarization. Index
snippets remain separate from fetched body text. Collection time does not
establish publication time, open recruitment, personal suitability, or
guidance quality. Failures and unknowns remain visible; fixed demo snapshots
never replace live attempts silently.

The server does not persist explorations. Topics, candidates, saved sources,
private reasons and questions use this browser's `localStorage`; their data
boundary and deletion behavior are in [Privacy](../product/privacy.md).

## Model Boundaries

Use separate models for separate purposes:

- DTOs represent HTTP input and output.
- Domain models represent business meaning.
- Application outputs represent use case results.
- DB rows represent persistence shape.

Conversions must be explicit. Do not return database rows directly from API
handlers, because rows may contain internal IDs, audit data, permission fields,
campus identity references, or future secret-adjacent data.

## Error Shape

API errors use:

```json
{
  "code": "validation_failed",
  "message": "The request is invalid.",
  "requestId": "...",
  "details": {}
}
```

Error code rules:

- `401`: unauthenticated.
- `403`: authenticated but not allowed.
- `404`: missing or intentionally invisible resource.
- `409`: state conflict or uniqueness conflict.
- `422`: business validation failure.
- `429`: rate limit.
- `500`: unexpected server error.

## Configuration

Configuration comes from environment variables or deployment secrets. Required
production settings must fail fast with clear errors. Tests must not read
production secrets.

Initialization supports:

- `SERVER_HOST` and `SERVER_PORT` in the API binary.
- `DATABASE_URL` for readiness checks and migrations.
- `CORS_ALLOWED_ORIGINS` as a comma-separated allowlist. `*` is allowed only as
  an explicit single value and must not be combined with cookie/session auth in
  production.
- `REQUEST_BODY_LIMIT_BYTES` as a positive integer request body limit.
- `RUST_LOG` for tracing filter configuration.

## Observability

The API must keep request IDs stable across middleware, logs, errors, and
frontend responses. Future logging should avoid raw tokens, raw campus identity
payloads, and private callback URLs.

Minimum operational signals before production:

- 5xx rate.
- p95 latency.
- Database connectivity.
- Migration status.
- Login failure rate.
- Queue depth if background jobs are added.

## Security Rules

- Enforce permissions in backend policy, not only in UI.
- Include visibility or permission scope in repository queries.
- Do not log secrets, bearer tokens, cookies, or raw identity assertions.
- Audit applicable server-side uploads, exports, shared-content deletion or
  restoration, role changes, and moderation overrides. Removing a private
  browser-local candidate or topic does not require a server audit event.

## Testing Expectations

Backend changes should have the narrowest meaningful tests:

- Domain tests for validation, permissions, and state transitions.
- Application tests for use case orchestration.
- Repository tests for persistence constraints and visibility.
- API integration tests for HTTP status, error shape, request ID, auth, and
  contract behavior.
- Migration smoke tests against PostgreSQL for schema changes.
