# 产品与开发里程碑

Last updated: 2026-10-06

## 2026-10-01 当前交付口径

用户确认当前交付是比赛 demo：先展示尽可能发现并组织可获取相关信息的价值，初期维护投入有限。历史信息可用于认识方向、候选和路径，注明时间与用途；当前报名、名额等状态另行判断。长期维护人力、周期和持续供给验证后置，不作为需求分析或 demo 的前置门槛。自动收集仅在实际运行后宣称，固定样本不当实时发现。具体检查与边界见[产品概览](overview.md)。下文历史维护安排仅在转向持续服务时按需启用。

## 当前执行基线

用户已授权重置产品规划。当前依据为[产品概览与需求基线](overview.md)。旧 M1–M7 待办取消；旧 M0.2 不再作为必须先完成的产品阶段，其未完项需按新需求重新立项。历史基础建设记录不等于本轮重新验证了代码，也不代表必须保留其技术或业务设计。

初版为个人使用工具，P1–P5 均围绕个人发现和参与体验展开。社区只是潜在扩展，不是当前功能或预定阶段。

采用 P1–P5 编号，避免与旧里程碑混淆。P1需求分析已形成v1.0，效果及长期供给仍未验证；当前可接续P2设计。产品调研覆盖不同用户与机会类型，首个验证案例为 AIDS 同学的导师探索，P4–P5 为条件性路线；不预先承诺工期。每阶段完成后根据证据调整下一阶段。

| 阶段 | 目标 | 交付物 | 退出条件 |
| --- | --- | --- | --- |
| P1 需求与信息供给验证 | 明确产品整体价值、用户场景与首版取舍 | 跨用户／场景需求地图、案例证据、共性与差异需求、替代服务对照、首版范围 | 说明产品可扩展的价值依据与边界，以及首个案例的收益、供给和未解问题；不能仅用导师案例代替整体需求分析 |
| P2 产品原型与技术取舍 | 将用户任务转为可用交互及实现方案 | 任务设计、Primer交互稿、内容关系、持久化／外部发现试验、资产复用评估 | 用真实内容及另一组偏好检查不同问题和自然结束位置；多主题保存、实际外部读取及主要异常有处理方案，明确系统与人工分工 |
| P3 比赛 demo | 展示选导师指南中的发现、理解与选择帮助 | 真实资料、实际外部发现与整理／合并、查询比较、按需指导和入口、多个持久探索主题 | 按交接稿8.2完成演示走查及必要工程检查，检查失败／中止及上限、误合并修正、主题私人理由隔离、个人内容选择发送与发送状态；区分固定样本与实际自动收集，允许停止，长期维护非前置 |
| P4 条件性扩充与持续更新 | 扩展类型和来源，降低维护成本 | 更多机会类型、去重与更新、稳定来源自动化 | 来源覆盖和更新频率可说明，维护负担可承受，过期信息可处理 |
| P5 条件性持续服务与发布 | 验证实际收益并修复问题 | 试用反馈、改进版本、发布及恢复说明 | 用户能发现相关机会并开始行动；关键故障解决；具备所需运行保障 |

## P1 基线与P2当前工作

2026-10-01已形成[需求分析v1.0](requirements-handoff.md)：八部分论证、当前采用范围与demo成果检查合并为独立可读主稿，配套[详细编号](requirements.md)与[研究记录](needs-analysis.md)。可交同伴评审并接续设计。核心方向已确认，尚无同伴对最新版的整体批准记录或实际效果结论。

当前[任务与信息结构设计v0.4](advisor-task-design.md)在六项用户任务及G1—G5建议工作包中保留结果整理／合并、失败继续、主题私人理由隔离、个人内容选择发送，以及中止／上限、误合并修正和发送状态。2026-10-04完成首轮Primer查找／正文依据／多主题保存／重开切片与开发者走查，采用同源浏览器保存、现有API和有限公开搜索／目录备用；10月5日接通两候选按问题比较、可改视角／关注点、逐项来源及主题私人记录。已有时间／读取数量边界不等于用户中止及完整上限提示已实现；误关联修正、模型整理与发送流程、按需资源界面仍待接通，P2整体及P3完整demo仍未完成。需求v1.0及10月3日新增操作与数据边界分别通过[PR #10](https://github.com/114August514/campus-agora/pull/10)、[PR #11](https://github.com/114August514/campus-agora/pull/11)进入main，本次变更补入运行时切片与检查记录；合并不代表同伴整体批准或学生收益已验证。

1. 两名候选研究与参与途径比较已完成开发走查，见[任务设计8.4](advisor-task-design.md#84)。下一轮验证关键未知的按需补查及候选理解；不先搭通用聊天壳。
2. 根据公开索引验证页和有限目录命中情况改善发现／整理，模型与费用在采用前决定；不以固定样本冒充实时结果。10月4日另完成一次现有浏览器读小红书招生帖、agent整理与批次展示路径，见[任务设计8.2](advisor-task-design.md#82)；应用内调用采集器和无人值守执行尚未实现。
3. 补主题条件编辑、用户中止及上限提示、误关联修正、按需支持／入口及完整走查；外部AI若采用，落实明确选择的个人输入及真实发送状态。同伴评审按具体分歧处理，不重复做广泛调研。

P4/P5只有决定继续投入时才启动，不是比赛完成的必经阶段。真实用户收益、返回观察和长期供给分别按所问问题安排；无本地问卷或长期维护预算不阻塞有限demo。

### 历史P1研究任务（已退出默认执行队列）

9月22—30日的样本数量、独立对照、一周返回、维护计时及UI迁移等任务记录保留于[AI日志](../ai-log/done.md)、[需求分析](needs-analysis.md)和研究附件。它们不构成串行通关门槛，不从旧编号恢复自动扩样、问卷或维护任务。已有四人内容样稿与任务设计继续复用；需要补证时先说明它会改变哪项演示或设计决定。

## P2–P3 实现准备

- 依据任务设计v0.4第8节G1—G5建议工作包拆分设计／开发票，复用P1样本；私人候选按已确认探索主题组织，不预先固定全部页面。
- 区分导师／课题组、机构、机会、指导、个人收藏；不沿用讨论帖模型作为默认业务模型。
- 评估已有 Web、后端、数据库和契约工具是否值得复用；记录保留、修改、停用的理由，技术选型不先于需求。
- 首轮公开浏览无需账号或校园身份，收藏采用同源浏览器保存；后续认证或同步仅按实际需求决定。
- 按任务设计落实结果的来源与时间、已有对象复用和冲突保留，以及失败后的继续；个人记录按主题隔离，外部AI请求仅组装用户明确选择的个人内容，接收服务及保留／删除条件在采用前明确。
- 在技术试验中确定查找上限和中止方式、误合并修正流程及AI发送状态的证据；按任务设计做一次真实发现到比较、双主题重开与异常检查的完整走查，模拟项分别标注。
- 把需求、页面、接口与验收任务对应起来，再拆成可独立交付的开发任务。
- 测试覆盖检索与筛选、未知条件、过期状态、关联指导、收藏保存和内容更新等关键行为；执行与改动相应的工程检查。

## 范围变更

论坛、校园身份、桌面端、复杂推荐等没有预留的必做阶段。加入功能需说明用户收益、已有替代、数据来源、维护成本及会延后什么；证据不足的功能保留为候选。

## 历史记录：旧 M 系列已退出执行计划

以下原文仅用于回看旧方案。其“当前阶段”“计划中”“必须”等文字均属于 2026-07-06 的历史计划，不产生现行任务或退出条件；与上述基线不一致时以上述基线为准。2026-09-22 的重置当时只调整仓库内计划。

2026-10-06 按用户要求清理远端旧路线 PR：[身份认证 #4](https://github.com/114August514/campus-agora/pull/4)、[归档后端 #5](https://github.com/114August514/campus-agora/pull/5)、[归档前端 #6](https://github.com/114August514/campus-agora/pull/6)、[讨论归档 #7](https://github.com/114August514/campus-agora/pull/7)、[审核与 AI 草稿 #8](https://github.com/114August514/campus-agora/pull/8) 均已关闭且未合并，未删除分支；清理完成时无开放 PR。历史实现保留供按新需求评估复用。同日后续已将当前导师探索功能及相关资料提交到[PR #12](https://github.com/114August514/campus-agora/pull/12)，尚未合并；后续 issue 未创建。

---

# 旧社区方案里程碑（已废止）

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

## 2026-09-24 学生发展文献补充

[九份社会科学研究材料](../constraints/student-development-literature.md)已用于修正需求分层：年级仅作上下文，补入当前课程学习支持任务，保留实习、竞赛和多种升学动机。下一步核查本校相应供给，并在同年级不同状态／不同年级相似任务中验证；不据文献直接批准功能或宣称本校需求比例。
