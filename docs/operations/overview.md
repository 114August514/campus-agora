# Operations Overview

M0.2 defines operational boundaries. It does not claim the project is production
ready.

## Environments

- Local: individual development data, disposable databases, mock auth.
- Development: shared integration environment with non-production data.
- Staging: production-like environment for release validation.
- Production: real users and real operational ownership.

Never copy production data into lower environments without a documented,
approved, and sanitized process.

## Backup And Restore

Before production:

- PostgreSQL backups must run on a fixed schedule.
- Backup retention must be documented per environment.
- Restore drills must happen before launch and after backup changes.
- Restore success means the app can boot, migrations are consistent, and smoke
  checks pass.

M0.2 does not implement backup automation.

## Monitoring Signals

Minimum signals before production:

- HTTP 5xx rate.
- p95 API latency.
- Database connection pool health.
- Migration status.
- Disk or object storage capacity.
- Login failure rate.
- Queue depth if background jobs are introduced.

## Alert Levels

- `P0`: service unavailable, database unavailable, data corruption, or leaked
  secret.
- `P1`: elevated error rate, migration failure, storage write failure, auth
  outage.
- `P2`: degraded latency, failed background job, non-critical integration issue.

Each alert needs an owner, a first-response action, and an escalation path.

## Runbook Seeds

Initial runbooks should cover:

- API unavailable.
- Database unavailable.
- Migration failed.
- Error rate increased.
- Storage not writable.
- Tauri update failed.
- Suspected secret exposure.

## Data Repair

Manual data repair is a high-risk operation:

- Prefer application-level repair tools over ad hoc SQL.
- Use a reviewed SQL script when direct database repair is unavoidable.
- Record the reason, operator, timestamp, affected rows, and rollback plan.
- Do not repair production data from an untracked local scratch command.
