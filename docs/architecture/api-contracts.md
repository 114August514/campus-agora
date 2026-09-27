# API Contracts

Last updated: 2026-07-26

Campus Agora uses `contracts/openapi.json` as the committed API contract
snapshot. The Rust API crate is the source of this contract.

## Generate

```bash
bun run api:types
```

This command exports OpenAPI from `crates/api` and regenerates
`packages/api-client/src/generated.ts`.

## Check

```bash
bun run api:check
```

CI runs this command to ensure generated files were committed. If it fails,
regenerate the contract and review the diff before committing.

## Rules

- Public endpoints must explicitly use `security: []` in the OpenAPI document.
- Protected endpoints declare the `bearerAuth` security scheme
  (`Authorization: Bearer <session token>`); missing or invalid tokens answer
  `401` with error code `unauthorized`.
- Business endpoints live under `/api/v1`.
- `/healthz`, `/readyz`, and OpenAPI tooling stay outside `/api/v1`.
- Errors use flat `ErrorResponse` fields:

  ```json
  {
    "code": "validation_failed",
    "message": "The request is invalid.",
    "requestId": "req_abc123",
    "details": {}
  }
  ```

  `details` is optional and must stay structured when present.

- Error codes use stable `snake_case` names.
- Resource paths use plural nouns and kebab-case. Auth action endpoints
  (`/api/v1/auth/mock-login`, `/api/v1/auth/logout`) are the documented
  exception: an authentication action does not model as a CRUD resource. New
  exceptions must be recorded here.
- Frontend code imports API types through `@campus-agora/api-client`, not by
  reaching into generated internals.

## Error Codes

Frontends branch on `code`, never on `message`. Current codes:

| Code | Status | Meaning |
| --- | --- | --- |
| `invalid_request_body` | 400 | The request body could not be parsed. |
| `unauthorized` | 401 | Missing, invalid, expired, or revoked session token. |
| `forbidden` | 403 | Authenticated or public caller is not allowed to act. |
| `auth_mock_disabled` | 403 | Mock campus login is turned off by capability flag. |
| `not_found` | 404 | Route or resource is missing or intentionally invisible. |
| `conflict` | 409 | State or uniqueness conflict. |
| `request_body_too_large` | 413 | Body exceeds `REQUEST_BODY_LIMIT_BYTES`. |
| `validation_failed` | 422 | Business validation failed. |
| `internal_error` | 500 | Unexpected server error; detail stays server-side. |

Error messages must not echo caller-supplied input. Add new codes to this
table in the same change that introduces them.

## Mock Parity

`createCampusAgoraMockFetch()` is the supported offline development mock. It
must answer with the same status codes, error codes, and response shapes as the
Rust API, including method-not-allowed handling and readiness failures. A mock
that disagrees with the server lets frontend tests pass against behavior that
does not exist. `packages/api-client/tests/client.test.ts` pins the parity
cases; extend both sides together.
