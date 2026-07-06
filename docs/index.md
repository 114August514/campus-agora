# Campus Agora Docs

Campus Agora is a campus discussion and knowledge archive platform. The current
repository phase is M0.2, which focuses on governance docs and risk boundaries.

## Quick Links

- Product scope: [Product / Overview](product/overview.md)
- Privacy: [Product / Privacy](product/privacy.md)
- Milestones: [Product / Milestones](product/milestones.md)
- Architecture overview: [Architecture / Overview](architecture/overview.md)
- API contracts: [Architecture / API Contracts](architecture/api-contracts.md)
- Auth and permissions: [Architecture / Auth And Permissions](architecture/auth-permissions.md)
- Local development: [Engineering / Development](engineering/development.md)
- Quality gates: [Engineering / Quality Gates](engineering/quality.md)
- Operations: [Operations / Overview](operations/overview.md)
- Security: [Operations / Security](operations/security.md)
- Agent task memory: [AI Log / Todo](ai-log/todo.md)

## Local Checks

```bash
bun install --frozen-lockfile
bun run api:types
bun run typecheck
bun run lint
bun run lint:styles
bun run test
bun run build
cargo clippy --workspace --all-targets -- -D warnings
bun run ci:docs
```
