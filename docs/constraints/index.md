# 约束参考

Last updated: 2026-10-05

## 2026-09-22 产品重置

现行产品范围以[产品概览](../product/overview.md)和[新里程碑](../product/milestones.md)为准。下表中的产品定位、内容边界、资料社区参考已转为历史资料，不能据此恢复旧社区任务。其他参考中的业务角色、论坛、归档、认证、桌面端和旧 M 系列要求，需要结合新范围重新评估；工程规范仅在相应能力被采用时适用，不构成必须建设该能力的理由。

本目录保存从本地参考笔记沉淀出来的项目约束。它们现在属于协作资料：修改某个领域前，应先阅读对应约束，再同步检查正式文档。

正式文档仍然是当前实现的事实来源。约束参考用于保留更细的边界、风险清单和设计意图，避免后续实现把关键问题简单处理掉。

当前 UI 唯一规范：[Primer 组件与视觉规范](../product/ui-system.md)，覆盖旧自由样式建议。

## 当前调研参考

- [开源项目复用调研](open-source-reuse-reference.md)：搜索／读取、研究流程与个人主题组织；第9节记录浏览器采集和辅助登录，第10节核对帮助选择的领域skill、个人决策、依据比较和理由结构，并给出两候选小试验建议；候选框架未安装。

- [成熟团队需求分析方法](requirements-practice-reference.md)：一手流程案例、证据复用、范围取舍与进入设计／开发的区别。

- [学生发展文献调研](student-development-literature.md)：教育学、社会学与职业发展研究，检验年级分层、学习支持、实习、竞赛及升学假设。

- [全产品需求地图](opportunity-needs-map.md)：跨用户、跨机会类型的案例证据、共性与差异需求及后续验证。

- [导师信息来源试采](mentor-source-reference.md)：首批官方入口与收集方法，服务已选定的导师探索场景。

- [AIDS 导师具体调研](aids-mentor-research.md)：十名人物方向初筛、招生渠道、个人方向探索与实验室比较、采集试验建议。

- [导师工作流需求证据](mentor-workflow-evidence.md)：官方流程案例、外部调查、替代方案、资料走查及候选需求验收。

## 阅读地图

| 修改领域 | 先读 | 再检查 |
| --- | --- | --- |
| 产品定位、内容边界、资料沉淀和讨论模型 | [产品定位参考](product-positioning-reference.md), [内容边界参考](content-boundary-reference.md), [资料社区参考](archive-community-reference.md) | [产品概览](../product/overview.md), [里程碑](../product/milestones.md) |
| 前端 UI、设计系统、组件结构 | [前端参考](frontend-reference.md) | [质量门禁](../engineering/quality.md), Web 源码 |
| 后端架构、配置、持久化、认证边界 | [后端参考](backend-reference.md) | [后端架构](../architecture/backend.md), [安全](../operations/security.md) |
| API 契约和前后端对接 | [API 契约参考](api-contract-reference.md) | [API 契约](../architecture/api-contracts.md), `contracts/openapi.json` |
| Monorepo 布局、包边界、CI 质量门禁 | [Monorepo 参考](monorepo-reference.md) | 根目录 `package.json`, `Cargo.toml`, `scripts/`, `tools/`, `docker/`, `.github/workflows/ci.yml` |
| 运维、安全、部署、备份、滥用防护 | [运维风险参考](operations-risk-reference.md), [产品治理参考](product-governance-reference.md) | `docs/operations/*`, [隐私](../product/privacy.md) |
| 高级工程风险和未来扩展细节 | [高级工程参考](advanced-engineering-reference.md) | 当前里程碑文档和相关架构文档 |

## 提升规则

当某个参考项变成实现要求时，必须提升到对应正式文档和里程碑中。已经接受的决策不能只留在参考笔记里。

当某个参考项被有意延期时，应在里程碑或 AI LOG 中记录后续归属，方便后续工作找回决策。
