# Campus Agora 文档

Last updated: 2026-09-27

Campus Agora 当前规划为面向大学生个人使用的机会发现与行动指导工具，内容覆盖跨校、跨学科的科研、导师、实习与竞赛。当前为 P1：需求与信息供给验证。初版仅包含个人使用体验，社区只是可能的未来扩展，没有预设开发阶段。

旧社区产品路线已废止；现有工程代码保留待评估，新产品尚未实现。产品范围与执行顺序以产品概览和里程碑为准。旧认证、隐私、社区治理与桌面端文档不自动构成新增功能任务，实施相关能力前需按新需求更新；可适用的工程与数据保护要求仍需遵循。

## 快速入口

同伴评审请先读[需求分析交接稿](product/requirements-handoff.md)，第10节提供研究附件索引和证据复用规则。

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
