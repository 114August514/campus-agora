# Campus Agora 文档

Campus Agora 是面向校园公共讨论与知识归档的平台。当前仓库阶段是 M0.2，重点是治理文档与风险边界。

## 快速入口

- 产品范围：[产品 / 概览](product/overview.md)
- 隐私：[产品 / 隐私](product/privacy.md)
- 里程碑：[产品 / 里程碑](product/milestones.md)
- 架构概览：[架构 / 概览](architecture/overview.md)
- API 契约：[架构 / API 契约](architecture/api-contracts.md)
- 认证与权限：[架构 / 认证与权限](architecture/auth-permissions.md)
- 本地开发：[工程 / 开发](engineering/development.md)
- 质量门禁：[工程 / 质量门禁](engineering/quality.md)
- 约束参考：[约束 / 阅读地图](constraints/index.md)
- 运维：[运维 / 概览](operations/overview.md)
- 安全：[运维 / 安全](operations/security.md)
- Agent 任务记忆：[AI Log / Todo](ai-log/todo.md)

## 本地检查

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
