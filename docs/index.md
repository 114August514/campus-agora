# Campus Agora 文档

Last updated: 2026-10-01

Campus Agora 当前规划为面向大学生个人使用的机会发现与行动指导工具，内容覆盖跨校、跨学科的科研、导师、实习与竞赛。需求分析已形成v1.0基线，接续同伴评审与任务设计，当前交付为选导师指南比赛demo。初版仅包含个人使用体验，社区只是可能的未来扩展，没有预设开发阶段。

旧社区产品路线已废止；现有工程代码保留待评估，新产品尚未实现。产品范围与执行顺序以产品概览和里程碑为准。旧认证、隐私、社区治理与桌面端文档不自动构成新增功能任务，实施相关能力前需按新需求更新；可适用的工程与数据保护要求仍需遵循。

## 快速入口

同伴请先读[需求分析 v1.0](product/requirements-handoff.md)：包含八部分需求论证、已确定范围与demo验收，第10节提供研究附件索引。文档定版不表示产品效果已经验证。

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
