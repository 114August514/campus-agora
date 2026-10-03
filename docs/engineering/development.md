# Development

Last updated: 2026-09-29

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

The UI system is fixed by [UI 组件与视觉规范](../product/ui-system.md):
Primer React Product UI, Primer Primitives and Octicons only, with no
handwritten CSS, Tailwind, CSS Modules, inline `style`, `sx` or CSS-in-JS.
The existing `src/styles` token/CSS files and hand-built primitives are legacy
M0 scaffolding awaiting migration; do not extend them.

Frontend code should stay organized by responsibility:

- `src/components/ui`: thin compositions of Primer components for shared
  loading, empty, error and permission states.
- `src/components/layout`: AppShell, Sidebar, Topbar, and status surfaces.
- `src/pages`: route-level composition.
- `src/hooks`: reusable client-side behavior.
- `src/lib`: framework-safe utilities and API wiring.

Pages should compose components. They should not hand-roll duplicate buttons,
inputs, modals, loading states, or error states.

## Design System Rules

- Use Primer Primitives tokens through Primer components; do not scatter
  literal colors or spacing in pages.
- Use Octicons for icons; do not add Lucide or other icon sets.
- Do not use bordered content cards, gradients, eyebrows or decorative
  subtitles; see the UI spec for the full list.
- Pages compose Primer layout and form components rather than one-off markup.

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
