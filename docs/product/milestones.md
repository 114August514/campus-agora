# 里程碑

本文是 GitHub Milestones 完整配置前的本地目标台账，用于把产品目标、工程范围、风险边界和验收条件从长篇初始化规格中抽离出来。

开启里程碑分支、接受新需求或调整范围前，应先阅读本文。若某项任务会改变里程碑含义，必须在同一个 PR 中同步更新本文。

## 使用方式

- `目标`：该里程碑必须证明的结果。
- `核心范围`：属于该里程碑的工作。
- `非目标`：没有明确范围决策前不应进入该里程碑的工作。
- `退出条件`：里程碑可以视为完成前必须满足的检查。
- `约束参考`：变更相关领域前必须阅读的深层约束文档。

## 当前阶段

仓库已完成 M0 与 M0.1。PR #3 承载 M0.2 的治理文档和前序评审修复。运行时产品功能不应在未更新本文的情况下超出当前里程碑。

## 汇总

| 里程碑 | 目标 | 状态 |
| --- | --- | --- |
| M0 | 可运行仓库骨架 | 已完成 |
| M0.1 | 契约与质量门禁 | 已完成 |
| M0.2 | 治理文档与风险边界 | 进行中 |
| M1 | 身份、权限与认证外壳 | 计划中 |
| M2 | 知识归档核心 | 计划中 |
| M3 | 讨论到归档闭环 | 计划中 |
| M4 | 审核与 AI 草稿 | 计划中 |
| M5 | 搜索与演示可用性 | 计划中 |
| M6 | 真实校园身份接入 | 计划中 |
| M7 | 生产运维与安全加固 | 计划中 |

## M0 可运行仓库骨架

目标：证明仓库可以运行。

核心范围：

- Bun workspace。
- React/Vite Web 外壳。
- Tauri WebView 外壳。
- Rust workspace，包含 domain、application、db、api crates。
- 最小 `/healthz` 与 `/api/v1/meta`。
- 基础 README、忽略规则、LFS 规则和 smoke checks。

非目标：

- 真实认证。
- 生产部署。
- 完整设计系统。
- 数据库驱动的产品工作流。

退出条件：

- 贡献者可以安装依赖、启动 Web 应用、运行 API，并执行最小 TypeScript 与 Cargo 检查。
- 仓库 metadata、license、ignore rules 和 LFS rules 已存在。

约束参考：

- [Monorepo Reference](../constraints/monorepo-reference.md)
- [Frontend Reference](../constraints/frontend-reference.md)
- [Backend Reference](../constraints/backend-reference.md)

## M0.1 契约与质量门禁

目标：建立可检查的工程循环。

核心范围：

- OpenAPI 导出与已提交的契约快照。
- 生成的 TypeScript API types。
- API client request wrapper 与 mock boundary。
- 扁平 `ErrorResponse`，包含稳定的 `code`、`message`、`requestId` 和可选 `details`。
- Request ID 传播。
- CORS allowlist 与 request body limit controls。
- `/readyz`、初始 SQL migration、`.env.example`。
- 基于 uv 的 MkDocs build、Dockerfile 和 CI jobs。

非目标：

- 真实 login/session 实现。
- 超出 metadata 与 health/readiness 的业务 API。
- Metrics dashboard 或 alerting 实现。
- 生产 secrets 或环境供给。

退出条件：

- CI 验证 contract drift、frontend checks、backend checks、desktop check、docs build、migration smoke 和 API image build。
- API errors、body limit rejections、missing routes 使用同一套携带 request id 的 JSON error contract。
- 生成的 OpenAPI 与 TypeScript types 已提交且无 drift。

约束参考：

- [API Contract Reference](../constraints/api-contract-reference.md)
- [Backend Reference](../constraints/backend-reference.md)
- [Operations Risk Reference](../constraints/operations-risk-reference.md)

## M0.2 治理文档与边界

目标：在运行时产品工作加速前，明确风险、治理、协作和产品方向。

核心范围：

- 产品范围、隐私、内容边界和里程碑文档。
- Architecture overview、backend、auth/permissions、API contracts 和 desktop docs。
- Development、quality、LFS 与 constraint-reference docs。
- Deployment、operations 和 security docs。
- 面向 AI 与人类协作者的 `AGENTS.md` workflow rules。
- MkDocs navigation，覆盖正式文档与约束参考。

非目标：

- 新增终端用户运行时工作流。
- 真实校园认证。
- Admin dashboard。
- 生产部署自动化。
- AI provider integration。

退出条件：

- 正式文档已组织好、可发布，并在 MkDocs 中可见。
- 根目录本地参考笔记已持久化到 `docs/` 下的约束参考中。
- `AGENTS.md` 说明在变更相关领域前应阅读哪些约束参考。
- M0、M0.1、M0.2 的 review findings 已修复，或明确分配到后续里程碑。

约束参考：

- [Constraint Reading Map](../constraints/index.md)
- [Product Positioning Reference](../constraints/product-positioning-reference.md)
- [Product Governance Reference](../constraints/product-governance-reference.md)

## M1 身份、权限与认证外壳

目标：引入认证与权限基础，同时避免过早绑定某一个校园 provider。

核心范围：

- Auth provider abstraction。
- Mock campus auth provider。
- User model、organization membership model 和 role model。
- Backend permission policies and tests。
- Frontend login state、guarded shell，以及 auth-aware API client behavior。
- Web 与 Tauri WebView 的 session/token storage policy。

非目标：

- 真实校园 CAS/OIDC integration。
- 完整 admin dashboard。
- Anonymous posting。
- File uploads。
- Public write launch。

退出条件：

- 前端可以通过 backend APIs 展示 authenticated state。
- Backend tests 覆盖 permission allow/deny cases。
- Roles 与 permission checks 符合 `docs/architecture/auth-permissions.md`。
- Privacy docs 描述 identity references 与 retention boundaries。

约束参考：

- [Product Governance Reference](../constraints/product-governance-reference.md)
- [Backend Reference](../constraints/backend-reference.md)
- [Advanced Engineering Reference](../constraints/advanced-engineering-reference.md)

## M2 知识归档核心

目标：支持可追踪、可更新的校园知识条目。

核心范围：

- Create、edit、list、search-lite 和 detail archive entries。
- Tags、categories、applicable audience 和 source fields。
- Version history。
- Correction entry point。
- Basic visibility rules。
- 前端 archive list/detail/editor flows，使用 shared component system。

非目标：

- AI-generated archive drafts。
- Full-text search engine。
- Real-time collaboration。
- 附件能力，除非明确接受文档化 placeholder。

退出条件：

- 知识条目可通过 UI 与 API 创建、更新、版本化、纠错和读取。
- Permission checks 阻止用户编辑权限范围外资源。
- API contract 与生成的 TS types 覆盖归档工作流。
- UI 使用 tokens/components，不使用页面局部的一次性样式。

约束参考：

- [Archive Community Reference](../constraints/archive-community-reference.md)
- [Frontend Reference](../constraints/frontend-reference.md)
- [API Contract Reference](../constraints/api-contract-reference.md)

## M3 讨论到归档闭环

目标：把开放讨论与可长期保存的归档产物连接起来。

核心范围：

- Discussion posts and replies。
- 高质量回复 highlight 或 accepted-answer flow。
- 将讨论引用或整理进 archive entries 的工作流。
- Archive entry 反向链接到 discussion context 的 source linkage。
- Draft、published、archived、hidden、deleted 等 content-state transitions。

非目标：

- 将匿名区作为 primary product surface。
- Recommendation algorithm。
- WebSocket notifications。
- Complex moderation automation。

退出条件：

- 有价值回复可以转换为归档条目，或以可追踪 source context 被归档条目引用。
- Content-state transitions 明确且有测试覆盖。
- UI 区分 discussion content 与 durable archive content。

约束参考：

- [Content Boundary Reference](../constraints/content-boundary-reference.md)
- [Archive Community Reference](../constraints/archive-community-reference.md)
- [Advanced Engineering Reference](../constraints/advanced-engineering-reference.md)

## M4 审核与 AI 草稿

目标：加入审核工作流和 AI-assisted archive drafting，同时保证发布权由人控制。

核心范围：

- Moderation queue。
- Risk states and audit events。
- AI summary 或 archive draft interface。
- Source-backed AI output，且要求 human review and edit。
- Basic abuse reporting and reviewer visibility。

非目标：

- Fully automated publishing。
- 无来源支撑的 opaque AI answers。
- Production-grade trust and safety automation。
- 在未更新 privacy/security docs 前接入真实 external AI provider。

退出条件：

- AI output 可追踪、可编辑、可审核，且不能绕过 human action 直接发布。
- Moderation actions 产生 audit events。
- 接入任何 third-party provider 前，privacy 与 security docs 已覆盖会发送的数据。

约束参考：

- [Operations Risk Reference](../constraints/operations-risk-reference.md)
- [Product Governance Reference](../constraints/product-governance-reference.md)
- [Advanced Engineering Reference](../constraints/advanced-engineering-reference.md)

## M5 搜索与演示可用性

目标：让系统具备可演示、可发现、足够稳定的核心 walkthrough。

核心范围：

- Full-text 或明确限定范围的 search。
- Saved entries 或 references。
- Contribution display。
- Stable seed data and demo script。
- Loading、empty、error、permission denied，以及相关 offline-friendly failure UI states。

非目标：

- Cross-campus expansion。
- Personalized recommendation ranking。
- Production SLOs。
- Real campus identity provider。

退出条件：

- 核心 answer path 对演示稳定，并通过 full CI。
- Demo data 不包含真实 student identity data。
- Search 尊重 visibility 与 permission filters。

约束参考：

- [Frontend Reference](../constraints/frontend-reference.md)
- [Advanced Engineering Reference](../constraints/advanced-engineering-reference.md)
- [Product Positioning Reference](../constraints/product-positioning-reference.md)

## M6 真实校园身份接入

目标：在 provider requirements 可用后接入真实校园身份，并避免重写业务权限模型。

核心范围：

- CAS、OAuth 或 OIDC provider implementation。
- Callback configuration。
- Test-account validation。
- Identity-reference hashing or minimization。
- Privacy and security review。

非目标：

- New permission model。
- 未达到 M7 operational readiness 前进行 broad production launch。
- 在 login exchange 之外存储 raw campus identity assertions。

退出条件：

- 真实用户可以通过校园身份登录。
- Business permissions 保持 provider-independent。
- Callback URLs、secrets 和 identity retention 已文档化。

约束参考：

- [Product Governance Reference](../constraints/product-governance-reference.md)
- [Operations Risk Reference](../constraints/operations-risk-reference.md)
- [Backend Reference](../constraints/backend-reference.md)

## M7 生产运维与安全加固

目标：在真实公开使用前完成部署与运维加固。

核心范围：

- Staging release process。
- Backup and restore drill。
- Monitoring、alerting 和 runbooks。
- Rate limiting 与 upload/download safety。
- Secret rotation policy。
- 若启用桌面端分发，制定 Tauri update signing plan。

非目标：

- 与 production readiness 无关的新产品范围。
- 在 backups、incidents 和 security review 没有明确 owner 前 public rollout。

退出条件：

- Staging 可以 deploy、migrate、health-check、roll back 和 restore，且 operational ownership 已文档化。
- Security docs 在生产策略要求处包含具体 retention windows。
- Incident response 与 recovery commands 可复现。

约束参考：

- [Operations Risk Reference](../constraints/operations-risk-reference.md)
- [Advanced Engineering Reference](../constraints/advanced-engineering-reference.md)
- [Product Governance Reference](../constraints/product-governance-reference.md)
