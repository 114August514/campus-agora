# API Contracts

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
- Business endpoints live under `/api/v1`.
- `/healthz`, `/readyz`, and OpenAPI tooling stay outside `/api/v1`.
- Errors use `{ "error": { "code", "message", "requestId" } }`.
- Error codes use stable `snake_case` names.
- Frontend code imports API types through `@campus-agora/api-client`, not by
  reaching into generated internals.
