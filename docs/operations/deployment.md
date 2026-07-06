# Deployment

M0.2 does not define production hosting. It provides the API image, migration
rules, release order, and rollback principles future environments should follow.

## API Image

```bash
docker build -f Dockerfile.api .
```

The image runs `campus-agora-api` and listens on `SERVER_HOST:SERVER_PORT`.

## Release Order

1. Build web assets and API image.
2. Build or package the desktop shell when the release includes desktop
   changes.
3. Deploy to staging.
4. Run database migrations.
5. Check `/healthz`, `/readyz`, and `/api/v1/meta`.
6. Run frontend smoke checks against staging.
7. Promote to production.
8. Run production smoke checks.

## Migration Failure

Migrations are forward-only once they reach a shared environment.

If a migration fails before any schema change is applied:

- Stop the release.
- Fix the migration in a new commit before retrying.

If a migration partially applies or production traffic depends on the new
schema:

- Do not edit the historical migration.
- Add a repair migration or compatible server fix.
- Record the incident and affected environment.

## Version Strategy

Track these independently:

- Web build version.
- API version.
- Database schema version.
- Tauri app version.
- Minimum supported client version.

The API should remain compatible with the minimum supported web and desktop
client versions during staged rollout.

## Rollback Principle

Prefer forward-only migrations once a migration reaches a shared environment.
If a release fails after migration, deploy a compatible server fix or a new
repair migration rather than editing historical migrations.

## Smoke Checks

Minimum release smoke checks:

```bash
curl -fsS "$BASE_URL/healthz"
curl -fsS "$BASE_URL/readyz"
curl -fsS "$BASE_URL/api/v1/meta"
```

For desktop releases, also launch the shell against the intended web origin and
confirm no unexpected Tauri capabilities were added.
