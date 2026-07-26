# 里程碑

Last updated: 2026-07-26

本文是 GitHub Milestones 完整配置前的本地目标台账，用于把产品目标、工程范围、风险边界和验收条件从长篇初始化规格中抽离出来。

开启里程碑分支、接受新需求或调整范围前，应先阅读本文。若某项任务会改变里程碑含义，必须在同一个 PR 中同步更新本文。

## 使用方式

- `目标`：该里程碑必须证明的结果。
- `核心范围`：属于该里程碑的工作。
- `非目标`：没有明确范围决策前不应进入该里程碑的工作。
- `退出条件`：里程碑可以视为完成前必须满足的检查。
- `约束参考`：变更相关领域前必须阅读的深层约束文档。

## 当前阶段

仓库已完成 M0、M0.1 与 M0.2。M1（身份、权限与认证外壳）与 M2（知识归档核心）已实现并在评审中，两者的退出条件均已满足，待评审通过后标记为已完成。M3（讨论到归档闭环）两个阶段均已实现并在评审中，退出条件已满足。M4（审核与 AI 草稿）进行中。运行时产品功能不应在未更新本文的情况下超出当前里程碑。

## 汇总

| 里程碑 | 目标 | 状态 |
| --- | --- | --- |
| M0 | 可运行仓库骨架 | 已完成 |
| M0.1 | 契约与质量门禁 | 已完成 |
| M0.2 | 治理文档与风险边界 | 已完成 |
| M1 | 身份、权限与认证外壳 | 评审中 |
| M2 | 知识归档核心 | 评审中 |
| M3 | 讨论到归档闭环 | 评审中 |
| M4 | 审核与 AI 草稿 | 进行中 |
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

交付拆分：

M2 的后端闭环与前端流程按两个阶段交付，沿用 M0 拆成 M0/M0.1/M0.2 的先例。
里程碑本身不拆分：只有两个阶段都完成，M2 才算达成退出条件。

- M2.1：归档后端闭环（domain 状态机与权限、application 用例、迁移与仓库、
  `/api/v1/knowledge-entries` 与契约）。计划见
  `docs/superpowers/plans/2026-07-26-m2-1-archive-backend-core.md`。
- M2.2：`components/ui` 基础组件、路由与 archive list/detail/editor 前端流程。
  计划见 `docs/superpowers/plans/2026-07-26-m2-2-archive-frontend.md`。

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

### 交付阶段

沿用 M0 与 M2 的先例，M3 按两个阶段交付；里程碑本身不拆分，只有两个阶段都
完成 M3 才算达成退出条件。

- M3.1（已交付）：讨论后端闭环。`archived` 状态与状态机、讨论权限动作、
  讨论与回复的 ports/用例/迁移/仓库、晋升与来源链接、
  `/api/v1/discussions` 与 `/api/v1/knowledge-entries/{id}/sources` 契约、
  api-client 方法与 mock 对齐。计划见
  `docs/superpowers/plans/2026-07-26-m3-1-discussion-archive-backend.md`。
- M3.2（已交付）：`/discussions` 命名空间下的列表/详情/发起流程、回复与采纳
  回答、晋升入口，以及来源链接与反向链接的双向展示。计划见
  `docs/superpowers/plans/2026-07-26-m3-2-discussion-frontend.md`。

退出条件核对：

1. **有价值回复可转换为归档条目，或以可追踪 source context 被引用** —— 讨论
   详情页对主帖和每条回复都提供「整理为资料」，创建的是晋升者自己的草稿并落
   在归档编辑器；`archive_sources` 记录来源并保留被引用者的作者身份。
2. **Content-state transitions 明确且有测试覆盖** —— 状态机在
   `crates/domain` 中定义，前后端各有一份按角色计算可用转换的表，三者由测试
   钉住；`archived` 的引入由 domain、db 谓词、mock、前端四处测试共同约束。
3. **UI 区分 discussion content 与 durable archive content** —— 两者使用彼此
   独立的路由命名空间与页面，展示的信号不同（讨论看回复数、采纳回答、最后活动；
   资料看版本、适用对象、来源、纠错），状态文案也按内容类型分别措辞。

状态仍为**评审中**而非已完成：退出条件已满足，但这个声明应当在评审之后。

### M3.1 已实现的关键决策

- `archived` 公开可读。归档条目要反向链接到来源讨论，链接必须能解析；
  移出视线是 `hidden` 的职责。详见
  [权限与授权](../architecture/auth-permissions.md)。
- `deleted` 不是 `moderation_status` 值，仍是 `deleted_at` 软删除——数据治理
  要求可恢复删除并留审计与责任人，状态值表达不了这些。
- 晋升只接受公开可读的来源，且创建的是晋升者自己的草稿，不修改来源；
  被引用回复的作者身份通过 `source_author_id` 保留。
- 来源链接两个方向都按读者可见性过滤。

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

### 交付阶段

沿用 M0、M2、M3 的先例分两阶段；里程碑本身不拆分。

- M4.1（进行中）：举报、审核队列、`pending_review` 状态、审计覆盖、
  AI 草稿的 port 与确定性 provider，以及契约/客户端/mock。计划见
  `docs/superpowers/plans/2026-07-27-m4-1-moderation-and-ai-drafting-backend.md`。
- M4.2（待做）：审核队列界面、举报流程、AI 草稿的人工复核界面。

### 三个决定

1. **审核是可选的，不是强制的。** 原始设计里的 `pending_review` 一直没实现。
   若让所有发布都必审，会推翻 M2 与 M3 已经确立并用测试钉住的「作者可发布
   自己的草稿」，把校园资料库变成先审后发的论坛——那是产品性质的改变。因此
   `pending_review` 只有两个入口：作者主动提交待审，以及举报把已发布内容退回
   复核。作者直接发布的路径不变。
2. **举报不是纠错。** 纠错说「这条资料过期或有误」，由维护者处理；举报说
   「这个内容违反规则」，而且可能正是关于维护者本人的。两者分表、分权限，
   审核举报的动作对 `Author` 与 `Maintainer` 列都是 Deny——被指控者不能结案。
3. **AI 不接外部 provider，也没有发布路径。** 沿用 M1 `MockCampusAuthProvider`
   的先例定义 port 与确定性本地实现。provider 的签名只返回文本与来源 id，
   拿不到任何仓库句柄，因此**没有可以发布的代码可供审查**——它压根不存在。
   生成的永远是普通草稿，走既有的人工发布路径。

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
