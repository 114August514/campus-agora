# Backend Architecture

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
- Treat uploads, exports, deletes, restores, role changes, and moderation
  overrides as high-risk actions requiring audit events.

## Testing Expectations

Backend changes should have the narrowest meaningful tests:

- Domain tests for validation, permissions, and state transitions.
- Application tests for use case orchestration.
- Repository tests for persistence constraints and visibility.
- API integration tests for HTTP status, error shape, request ID, auth, and
  contract behavior.
- Migration smoke tests against PostgreSQL for schema changes.
