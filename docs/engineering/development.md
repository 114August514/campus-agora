# Development

Last updated: 2026-07-26

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
- `POST /api/v1/auth/mock-login`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/logout`
- `GET|POST /api/v1/knowledge-entries`
- `GET|PATCH /api/v1/knowledge-entries/{id}`
- `POST /api/v1/knowledge-entries/{id}/status`
- `GET /api/v1/knowledge-entries/{id}/revisions`
- `GET|POST /api/v1/knowledge-entries/{id}/corrections`
- `POST /api/v1/knowledge-entries/{id}/corrections/{correctionId}/resolve`

`/readyz` checks PostgreSQL when `DATABASE_URL` is configured.

The API refuses to start without `DATABASE_URL`. To run without a database,
set `AUTH_STORE_MEMORY=true`; auth then uses a non-persistent in-memory store
suitable for local development and tests only.

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
- `src/app`: the route table and the application root.
- `src/components/ui`: reusable primitives.
- `src/components/icons`: the single Lucide entry point.
- `src/components/layout`: AppShell, Sidebar, Topbar, and status surfaces.
- `src/features`: business hooks, feature UI, and copy constants.
- `src/pages`: route-level composition.
- `src/hooks`: reusable client-side behavior.
- `src/lib`: framework-safe utilities and API wiring.

Pages should compose components. They should not hand-roll duplicate buttons,
inputs, modals, loading states, or error states.

Current primitives: `Button` (primary, secondary, ghost, danger, plus a
loading state), `Input`, `Textarea`, `Select`, `Card`, `Badge`, `EmptyState`,
`LoadingState`, `ErrorState`, `Pagination`. Modal, Drawer, Dropdown, Tabs, and
Toast are not built yet; add them when a flow needs one, together with a
`/design-system` section and a test.

## Routing

Routes live in `src/app/routes.ts` as data, so navigation and tests share one
set of path strings instead of duplicating literals:

- `/` home
- `/archive` list, with `q`, `tag`, `category`, and `page` in the query string
- `/archive/new` editor, create mode
- `/archive/:id` detail
- `/archive/:id/edit` editor, edit mode
- `/design-system` the visual system reference

Archive filters live in the URL on purpose. The product is about knowledge
that can be referenced, so both an entry and a filtered list must be linkable.

## Design System Rules

- Use design tokens for colors, spacing, radius, typography, shadows, and focus
  treatment.
- Use Lucide rounded outline icons with 2px stroke where an icon is available.
- Do not introduce one-off colors or arbitrary spacing without updating tokens.
- Keep cards, modals, controls, and layout primitives consistent across pages.
- Add or update `/design-system` when a reusable primitive or state component
  becomes part of the product surface. It renders every primitive plus the
  loading, empty, error, unauthorized, and forbidden states, and is the manual
  visual-regression entry point.
- Never hand-write an SVG icon in a page. Add it to `src/components/icons`
  and import it from there.
- Every colour token defined in `tokens.css` must have a dark-theme override in
  `themes.css`; a test enforces this, because a missing override silently keeps
  the light value.

## API And Mock Mode

Use `@campus-agora/api-client` for API access. Do not call `fetch` directly from
deep page components.

Local mock behavior should use typed API client mocks, currently
`createCampusAgoraMockFetch()`. Set `VITE_API_MOCK=true` to run the web app
against it without a backend; `apps/web/tests/setup.ts` sets the same variable
so component tests never reach a real server.

App-specific fixture data belongs in web app mock folders or test fixtures.
The mock transport accepts a `users` override for exactly that reason, so
product fixtures do not have to live in the API client package.

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
