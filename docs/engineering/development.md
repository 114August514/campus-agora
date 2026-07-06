# Development

## Requirements

- Bun `1.3.14`
- Rust stable with `rustfmt` and `clippy`
- PostgreSQL 16 for migration smoke tests
- uv for MkDocs

## Local API

```bash
cp .env.example .env
cargo run -p campus_agora_api
```

The API exposes:

- `GET /healthz`
- `GET /readyz`
- `GET /api/v1/meta`

`/readyz` checks PostgreSQL when `DATABASE_URL` is configured.

## API Client

```bash
bun run api:types
bun --cwd packages/api-client test
```

Pages and hooks should call the API through `@campus-agora/api-client`.
Use `createCampusAgoraMockFetch()` for local mock wiring and tests.

## Repository Scripts

Shared automation lives in `scripts/`. Use the root `bun run ci:*` commands to
run the same checks that CI runs for frontend, backend, desktop, contracts,
docs, and container builds. Use `bun run build:all` for a local all-target
build check.

## Frontend Organization

Frontend code should stay organized by responsibility:

- `src/styles`: tokens, themes, and global CSS.
- `src/components/ui`: reusable primitives such as Button, Input, Modal, Card,
  Badge, Toast, and loading or empty states.
- `src/components/layout`: AppShell, Sidebar, Topbar, and status surfaces.
- `src/pages`: route-level composition.
- `src/hooks`: reusable client-side behavior.
- `src/lib`: framework-safe utilities and API wiring.

Pages should compose components. They should not hand-roll duplicate buttons,
inputs, modals, loading states, or error states.

## Design System Rules

- Use design tokens for colors, spacing, radius, typography, shadows, and focus
  treatment.
- Use Lucide rounded outline icons with 2px stroke where an icon is available.
- Do not introduce one-off colors or arbitrary spacing without updating tokens.
- Keep cards, modals, controls, and layout primitives consistent across pages.
- Add or update a style guide page when a reusable primitive or state component
  becomes part of the product surface.

## API And Mock Mode

Use `@campus-agora/api-client` for API access. Do not call `fetch` directly from
deep page components.

Local mock behavior should use typed API client mocks, currently
`createCampusAgoraMockFetch()`. Mock data belongs in web app mock folders or
test fixtures, not in production API client code.

## UI Copy

Common action labels, empty states, error states, and status text should use a
consistent tone. Avoid mixing English and Chinese labels in the same product
surface unless the page has an explicit localization design.

Error messages should describe the user-facing recovery path:

- "Save failed. Check your connection and try again."
- "This name already exists."
- "You do not have permission to perform this action."

## Dependency Updates

Dependency updates should be small and reviewable:

- Update one ecosystem at a time when possible.
- Keep lockfiles committed.
- Run the affected `bun run ci:*` script.
- For major upgrades, record migration risks in the PR description.
