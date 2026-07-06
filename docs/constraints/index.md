# 约束参考

本目录保存从本地参考笔记沉淀出来的项目约束。它们现在属于协作资料：修改某个领域前，应先阅读对应约束，再同步检查正式文档。

正式文档仍然是当前实现的事实来源。约束参考用于保留更细的边界、风险清单和设计意图，避免后续实现把关键问题简单处理掉。

## 阅读地图

| 修改领域 | 先读 | 再检查 |
| --- | --- | --- |
| 产品定位、内容边界、资料沉淀和讨论模型 | [产品定位参考](product-positioning-reference.md), [内容边界参考](content-boundary-reference.md), [资料社区参考](archive-community-reference.md) | [产品概览](../product/overview.md), [里程碑](../product/milestones.md) |
| 前端 UI、设计系统、组件结构 | [前端参考](frontend-reference.md) | [质量门禁](../engineering/quality.md), Web 源码 |
| 后端架构、配置、持久化、认证边界 | [后端参考](backend-reference.md) | [后端架构](../architecture/backend.md), [安全](../operations/security.md) |
| API 契约和前后端对接 | [API 契约参考](api-contract-reference.md) | [API 契约](../architecture/api-contracts.md), `contracts/openapi.json` |
| Monorepo 布局、包边界、CI 质量门禁 | [Monorepo 参考](monorepo-reference.md) | 根目录 `package.json`, `Cargo.toml`, `scripts/`, `.github/workflows/ci.yml` |
| 运维、安全、部署、备份、滥用防护 | [运维风险参考](operations-risk-reference.md), [产品治理参考](product-governance-reference.md) | `docs/operations/*`, [隐私](../product/privacy.md) |
| 高级工程风险和未来扩展细节 | [高级工程参考](advanced-engineering-reference.md) | 当前里程碑文档和相关架构文档 |

## 提升规则

当某个参考项变成实现要求时，必须提升到对应正式文档和里程碑中。已经接受的决策不能只留在参考笔记里。

当某个参考项被有意延期时，应在里程碑或 AI LOG 中记录后续归属，方便后续工作找回决策。
