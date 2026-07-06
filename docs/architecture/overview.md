# Architecture Overview

Campus Agora is a monorepo with explicit boundaries between frontend,
desktop shell, shared API client, backend crates, contracts, and documentation.

## Repository Areas

- `apps/web`: React/Vite application and user-facing UI.
- `apps/desktop`: Tauri shell that hosts the web app in a WebView.
- `packages/api-client`: browser and WebView-safe TypeScript API client.
- `contracts`: committed OpenAPI contract snapshots.
- `crates/domain`: pure domain types, validation, policy, and state rules.
- `crates/application`: use cases, service orchestration, and repository
  traits.
- `crates/db`: SQL migrations and database-backed repository implementations.
- `crates/api`: Axum HTTP server, routing, DTOs, middleware, and contract
  export.
- `docs`: product, architecture, engineering, operations, and AI LOG docs.

## Dependency Direction

Allowed backend direction:

```text
crates/api -> crates/application -> crates/domain
crates/api -> crates/db
crates/db -> crates/application traits + crates/domain
```

Allowed frontend direction:

```text
apps/web -> packages/api-client -> contracts/openapi.json
apps/desktop -> apps/web build output
```

Forbidden dependencies:

- Domain code must not depend on Axum, SQLx, Tauri, or TypeScript.
- Application code must not depend on API DTOs or SQLx row models.
- Database code must not depend on Axum handlers.
- Web pages must not reach into generated API internals directly.
- Tauri commands must not implement core discussion, archive, moderation, or
  permission business logic.

## Runtime Shape

The default product runtime is HTTP API plus web client. Tauri is a desktop
container and local capability bridge, not a separate business backend.

```text
Web/Tauri WebView -> TypeScript API client -> Axum API -> application -> domain
                                             -> db -> PostgreSQL
```

## Change Rule

When a change crosses a boundary, update the owning documentation:

- API shape: `docs/architecture/api-contracts.md`.
- Auth or permission behavior: `docs/architecture/auth-permissions.md`.
- Backend layering or config: `docs/architecture/backend.md`.
- Tauri capability or local bridge: `docs/architecture/desktop.md`.
- Product scope or privacy: `docs/product/*`.
