# Quality Gates

M0.1 turns the repository skeleton into a checked engineering loop.

## Required Local Checks

```bash
bun run build:all
bun run ci:frontend
bun run ci:desktop
bun run ci:contract
bun run ci:docs
```

## Service Checks

```bash
bun run ci:backend
bun run ci:container
```

The service checks require local PostgreSQL and Docker. MkDocs dependencies are
managed by uv through `tools/docs/pyproject.toml` and `tools/docs/uv.lock`.

## Script Boundary

Shared multi-step workflows live in `scripts/`. The scripts mirror CI jobs and
can be run through `bun run ci:*` shortcuts from the repository root.

Keep `.github/workflows/ci.yml` as one workflow while all jobs share pull
request and `main` push triggers. Split workflows when a job needs a different
trigger, permission boundary, deploy target, or scheduled cadence.

## Contract Drift

Run `bun run api:check` before merging API changes. It regenerates OpenAPI and
TypeScript types, then fails if the committed generated files are stale.

## Accessibility

M0.2 uses review and component-level checks rather than a full automated a11y
suite. New UI primitives must still provide:

- Accessible names for buttons and icon buttons.
- Visible focus states.
- Text alternatives for non-decorative icons.
- Error text associated with invalid fields.
- Keyboard-reachable controls.

## UI Regression Boundary

Before screenshot regression exists, review UI changes against:

- Token usage instead of one-off colors.
- Shared primitives instead of duplicate hand-built controls.
- Responsive layout at mobile and desktop widths.
- Loading, empty, error, unauthorized, forbidden, and offline states.

## Performance Budget

Early pages should avoid expensive defaults:

- No unbounded lists.
- Paginate or virtualize long collections.
- Keep route-level chunks small.
- Do not add large UI or chart libraries without a clear owner and review.
- Avoid repeated network requests caused by render loops.

## Seed, Mock, And Fixture Data

- Seed data is for local demos and development flows.
- Mock data is for frontend and API-client behavior while backend work is
  incomplete.
- Test fixtures are for deterministic tests.

These must not contain real student identity data, real phone numbers, real
emails, real campus identifiers, or production exports.

## Feature Flags

Feature flags come from backend config or application service output, surfaced
through `/api/v1/meta` or future typed endpoints. Frontend code consumes flags;
it must not treat hidden UI as authorization.

Changing a capability flag requires updates to:

- OpenAPI contract.
- Generated TypeScript types.
- API client mock.
- Frontend consumption point.
- API contract documentation.

## Version Strategy

Track these versions separately:

- Web build version.
- API version.
- Database schema version.
- Tauri app version.
- Minimum supported client version.

Deployment docs own release order and rollback rules.

## Review Checklist

Before merging high-risk changes, confirm:

- Permissions are enforced in backend policy.
- Audit events or audit intent are produced for high-risk writes.
- Privacy docs reflect new data collection or retention.
- Security docs reflect new secrets, uploads, rate limits, or Tauri
  capabilities.
- MkDocs builds with `bun run ci:docs`.
