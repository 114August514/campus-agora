# Milestones

Milestones describe staged product and engineering outcomes. They are the local
source of truth until GitHub Milestones are configured.

## M0 Repository Skeleton

Goal: prove the repository can run.

Deliverables:

- Bun workspace.
- React/Vite web shell.
- Tauri WebView shell.
- Rust workspace with domain, application, db, and api crates.
- Minimal `/healthz` and `/api/v1/meta`.
- Basic README, ignore rules, LFS rules, and smoke checks.

Exit criteria: a new contributor can install dependencies, start the web app,
run the API, and execute minimal typecheck and cargo checks.

## M0.1 Contract And Quality Gates

Goal: establish a checked engineering loop.

Deliverables:

- OpenAPI export and committed contract snapshot.
- Generated TypeScript API types.
- API client request wrapper and mock boundary.
- Request ID propagation and uniform error response.
- `/readyz`, initial SQL migration, `.env.example`.
- uv-backed MkDocs build, Dockerfile, and CI jobs.

Exit criteria: CI can validate contract drift, frontend checks, backend checks,
desktop check, docs build, migration smoke, and API image build.

## M0.2 Governance Docs And Boundaries

Goal: make risk, governance, and collaboration boundaries explicit.

Deliverables:

- Product scope, privacy, and milestones docs.
- Architecture overview, backend, auth/permissions, API contracts, and desktop
  docs.
- Development, quality, and LFS docs.
- Deployment, operations, and security docs.
- MkDocs navigation for formal docs.

Exit criteria: formal docs are organized, publishable, and cover high-risk
future directions before runtime work begins.

## M1 Identity, Permissions And Shell

Goal: introduce authentication and permission foundations.

Deliverables:

- Auth provider abstraction.
- Mock campus auth provider.
- User model and roles.
- Backend permission policies.
- Frontend login state and guarded shell.

Exit criteria: the frontend can show authenticated state from backend APIs, and
backend tests cover permission allow/deny cases.

## M2 Knowledge Archive Core

Goal: support durable knowledge entries.

Deliverables:

- Create, edit, tag, list, and detail archive entries.
- Version history.
- Correction entry point.
- Basic visibility rules.

Exit criteria: a knowledge entry can be created, updated, versioned, corrected,
and retrieved through the UI and API.

## M3 Discussion To Archive Loop

Goal: connect discussion with durable archive output.

Deliverables:

- Discussion posts and replies.
- Highlight or accepted answer flow.
- Workflow to cite discussion into archive entries.

Exit criteria: a useful reply can be converted or referenced into an archive
entry with traceable source context.

## M4 Moderation And AI Drafting

Goal: add review workflows and AI-assisted drafts.

Deliverables:

- Moderation queue.
- Risk states.
- AI summary or archive draft interface.
- Human review and edit requirement.

Exit criteria: AI output is traceable, editable, reviewable, and cannot publish
without human action.

## M5 Search And Demo Readiness

Goal: make the system demonstrable and discoverable.

Deliverables:

- Full-text search.
- Saved entries or references.
- Contribution display.
- Demo script and stable seed flow.

Exit criteria: the core answer path is stable for presentation and passes full
CI.

## M6 Real Campus Identity Integration

Goal: connect real campus identity after provider requirements are available.

Deliverables:

- CAS, OAuth, or OIDC provider implementation.
- Callback configuration.
- Test-account validation.
- Privacy and security review.

Exit criteria: real users can log in through campus identity without rewriting
business permissions.

## M7 Production Operations And Security

Goal: harden deployment and operations.

Deliverables:

- Staging release process.
- Backup and restore drill.
- Monitoring, alerting, and runbooks.
- Rate limiting and upload/download safety.
- Tauri update signing plan.

Exit criteria: staging can deploy, migrate, health-check, roll back, and restore
with documented operational ownership.
