# Campus Agora Docs

Campus Agora is a campus discussion and knowledge archive platform. The current
repository phase is M0.1, which focuses on API contracts and quality gates.

## Quick Links

- API contracts: [Architecture / API Contracts](architecture/api-contracts.md)
- Local development: [Engineering / Development](engineering/development.md)
- Quality gates: [Engineering / Quality Gates](engineering/quality.md)
- Deployment basics: [Operations / Deployment](operations/deployment.md)
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
```
