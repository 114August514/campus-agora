# Deployment

M0.1 does not define production hosting. It provides the API image and the order
of operations future environments should follow.

## API Image

```bash
docker build -f Dockerfile.api .
```

The image runs `campus-agora-api` and listens on `SERVER_HOST:SERVER_PORT`.

## Release Order

1. Build web assets and API image.
2. Deploy to staging.
3. Run database migrations.
4. Check `/healthz` and `/readyz`.
5. Promote to production.
6. Run smoke checks against `/api/v1/meta`.

## Rollback Principle

Prefer forward-only migrations once a migration reaches a shared environment.
If a release fails after migration, deploy a compatible server fix or a new
repair migration rather than editing historical migrations.
