# 产品与开发里程碑

Last updated: 2026-09-29

## 当前执行基线

用户已授权重置产品规划。当前依据为[产品概览与需求基线](overview.md)。旧 M1–M7 待办取消；旧 M0.2 不再作为必须先完成的产品阶段，其未完项需按新需求重新立项。历史基础建设记录不等于本轮重新验证了代码，也不代表必须保留其技术或业务设计。

初版为个人使用工具，P1–P5 均围绕个人发现和参与体验展开。社区只是潜在扩展，不是当前功能或预定阶段。

采用 P1–P5 编号，避免与旧里程碑混淆。当前 P1 进行中，产品调研覆盖不同用户与机会类型，首个验证案例为 AIDS 同学的导师探索，P2–P5 是候选路线；不预先承诺工期。每阶段完成后根据证据调整下一阶段。

| 阶段 | 目标 | 交付物 | 退出条件 |
| --- | --- | --- | --- |
| P1 需求与信息供给验证 | 明确产品整体价值、用户场景与首版取舍 | 跨用户／场景需求地图、案例证据、共性与差异需求、替代服务对照、首版范围 | 说明产品可扩展的价值依据与边界，以及首个案例的收益、供给和未解问题；不能仅用导师案例代替整体需求分析 |
| P2 产品原型与技术取舍 | 用真实内容验证发现到行动体验 | 页面原型、内容模型、接口草案、资产复用评估 | 用真实案例走通需求到行动，并用另一组偏好复走；明确系统与人工分工，核心问题有处理方案 |
| P3 首个可用版本 | 实现选导师指南这一完整场景 | Web 体验、查询与收藏、关联指导、维护入口 | 完成真实样本任务，必要检查通过；个人独立完成发现与准备流程，无社区功能；校园 SSO 非前置条件 |
| P4 扩充与持续更新 | 扩展类型和来源，降低维护成本 | 更多机会类型、去重与更新、稳定来源自动化 | 来源覆盖和更新频率可说明，维护负担可承受，过期信息可处理 |
| P5 小范围试用与发布 | 验证实际收益并修复问题 | 试用反馈、改进版本、发布及恢复说明 | 用户能发现相关机会并开始行动；关键故障解决；具备所需运行保障 |

## P1 当前工作清单

**2026-09-29首版定位：**用户确认首版为选导师指南，不区分本校与外校；P2设计与P3首个可用版本均以该场景为完整切片，另保留入口直达轻任务。其他机会类型不进入P3，非科研样例用作P4扩展前的结构检查。详见[交接稿](requirements-handoff.md)第2、6节。

**2026-09-27现行顺序：**需求分析已有可评审基线，采用既有证据进入任务／信息结构与首版方案设计。P1中效果和持续供给仍未实证完成，但不阻塞有限P2设计；下方历史补查任务仅在影响具体决定时触发。停止默认增加案例、反复来源复核或等待访谈；H/V未完成如实保留，不等于全部必须先执行。推荐范围见[需求分析文首](needs-analysis.md)。

2026-09-26用户再次明确当前回到需求论证：以[需求分析第4—5节](needs-analysis.md)的需要、现有办法缺口和使用价值为主，导师样稿／维护计时暂作可行性旁证，不自动续做。已分开P06入口、认定、进度及P05保存、推送的依据；首版取舍仍待证据收敛。

2026-09-26范围收敛建议已写入[需求分析第6节](needs-analysis.md)：区分共同基础、按任务组合的能力与待定首版项；N06不再要求通用准备产出。当前仍是候选取舍，未新增用户证据，未冻结首版覆盖或批准实现。

2026-09-26研究偏向复核：范围已广，证据与验收仍偏科研、正式公开材料及深入比较。下一项优先补不同起点／深度的发现与取舍任务，供给复核仅支撑所选任务，不自动继续扩张。具体纠正见[需求分析第7节](needs-analysis.md)；不新增验证编号，不改变导师首例或产品边界。以下9月25日顺序受此修正。

2026-09-25执行清单收敛：关键假设H1–H6、V1–V5定义与决策规则仅在[需求分析第8节](needs-analysis.md)维护。先补实际体验来源可得性与供给成本，再开展可比候选任务；公开材料主要覆盖自述／条件，不能把考察方法当成已取得的实际体验。其他编号为历史工作归档或具体案例，不另起一套验证定义。

**2026-09-25 侧重点纠偏**：优先验证信息发现、理解比较与自主选择的增量；准备指导说明重点和理由，资源提供适用支持及入口。逐章节内容建设、Python 知识教学对照与学习效果测试退出当前任务，不是 P1 退出条件。资源适配研究保留旁证；不因已有研究就继续深化。后续按“哪些信息难发现 → 哪些差异难判断 → 最少需什么指导与支持”补齐需求论证，具体边界见[概览](overview.md)。

**当前优先顺序（2026-09-24 用户纠正）**：先按[需求分析八部分与完成标准](requirements.md)整理完整论证：背景、对象、现有办法、问题与需求、价值、范围、功能要求、可行性与验收。已有原型和 N01–N13 不代表该论证完成。已有证据现已归入[需求分析初稿](needs-analysis.md)，下一步执行同任务替代对照、停止案例、不同目标参与者观察与维护计时，再补关键缺口；原型观察辅助验证，UI 迁移不自动优先于这项工作。


下列数量是可调整的取样预算，不是需求规模或质量结论。导师样本服务于工作流验证，不以填满名录为主线；先用少量真实内容验证完整路径，再按暴露的问题扩样。

- UI 准备：已固定 [Primer 组件与视觉规范](ui-system.md)；下一版内容原型先迁移至该体系，旧 HTML 的 CSS、卡片与装饰文案不再沿用。依赖安装、精确锁版和自动规则检查尚未执行。
- 2026-09-25 本校供给补查：已形成[六组支持入口与三个按需帮助样例](../constraints/student-development-literature.md)，区分已有服务、历史报道和未核实可用性；下一步原站／通用 AI 同任务对照和维护计时，不以入口发现视为收益验证。
- P1-15（候选需求与验证工具）：已形成[需求基线草案](requirements.md)，统一 N01–N13、完整路径、供给与 V1–V5。N13 是形势与政策的桌面候选，尚未进入六条样本原型。已制作六条样本的独立内容原型（`tools/prototypes/opportunities.html`），完成主要交互检查；下一步实际任务观察与供给计时，按结果收敛首版；无需等全部未知项清零，也未宣称 P1 完成。
- P1-14：已完成科大资源入口试采，将算力、文献、设备与项目支持接入准备案例，形成 G12。下一步验证“任务＋资源入口”的实际增量，补齐具体权限、适配性和更新成本；不能把平台存在当作个人可用。
- P1-13（专项验证）：已补充[跨场景能力与准备案例、准备卡和 G8–G11](../constraints/opportunity-needs-map.md)。以任务理解、条件分层、可选试做及现有支持为指导重点；办理保留关键条件和官方入口。已完成 AlphaEdit、BCG 模拟、物理实验竞赛三张真实内容卡及原页对照，明确设备约束、现成指导复用和历史通知边界。下一步观察指导理解与实际增量，独立计量内容维护成本；尚未完成用户验证。
- P1-12：已形成[全产品需求地图与 G1–G7 假设](../constraints/opportunity-needs-map.md)，记录十组案例／数据与能力差异；下一步补齐覆盖缺口、进行跨场景任务观察和供给试采，不将桌面研究等同验证完成。
- P1-11（广度与覆盖）：建立跨学科、阶段和目标的用户需求地图，对科研、导师／升学、实习、竞赛、交流及活动通知逐类收集案例、数据与替代方案；检验可共用能力及差异，阐明产品上限，再收敛首版。
- P1-10：已形成[需求证据与 R1–R8 草案](../constraints/mentor-workflow-evidence.md)，包括官方流程案例、外部调查及两条资料走查；下一步验证真实用户任务、替代方案和维护成本，收敛优先级。此为桌面研究进展，不标记需求分析完成。
- P1-09（首个深入案例）：将用户找导师作为首条真实案例，逐步记录需求输入、来源发现、信息整理、方向理解、候选比较、行动建议和返回更新；标明人工补位与拟产品能力。用另一组偏好复走，检查流程是否复用，不把个人名单交付当成项目完成。
- P1-01：优先整理约 20–30 条导师／课题组样本，覆盖科大、内地外校、研究所、香港和美国等地区，首批聚焦 AIDS 同学的 AI、AI＋软件、AI 系统及软件研究兴趣；关联官方招生项目，记录目标入学年份、招募不明和已截止等情况。
- P1-08：已形成[十名人物方向初筛及渠道调研](../constraints/aids-mentor-research.md)，补充近期作品、指导体验的待问问题与研究／就业分别比较；验证少量公开主页和招生页采集，再评估社交平台入口。初筛不是完整招生核验，P1-01 尚未完成。
- P1-02：整理现有教师目录、科研入口、招聘服务、竞赛汇总和指导资源，按具体任务对照，不把“存在服务”当作需求已解决，也不把搜索未找到当作服务不存在。
- P1-03：为每类场景形成“用户目标 → 现有操作 → 困难 → 可提供的帮助 → 替代方案”的需求表。
- P1-04：估算首批来源整理和更新工作量，识别需要持续维护的关键字段，判断少数维护者能否承担。2026-09-24 核对网络信息中心公开说明后，学生有没有词元计划密钥不再作为需求问题。两把密钥的实现仍未开工：不实现爬虫、密钥调用、小红书采集或群机器人。未同意的群聊不采集。额度与密钥能否填入本站留到实现时核对。
- P1-05：首个验证案例已选定为导师探索；结合跨场景研究，按实际收益、个人使用体验、内容供给和实现成本细化范围，列出首版必需、可选和暂缓功能。
- P1-06：制定原型任务和观察记录；仅当公开资料不能解决关键选择时，进一步访谈或问卷，不以调查数量作为完成标准。
- P1-07（当前调研，实施顺序待定）：行策学分规则已核对。听课报名入口是马院通知公告《“形势与政策”课程预告》，见需求地图 2026-09-24 专节和 N13。页内二维码后的场次表尚未读，计入标记和名额仍待核。个人订阅是否进入首版，要先对照该报名页和教务系统已有通知。无需组织方入驻或社区互动。

P1 退出时，不要求证明全校需求规模；必须明确为什么选择首个场景，以及哪些假设仍待试用检验。若来源不足或替代工具已充分解决问题，可调整场景，不强行开发。

2026-09-25 共性判断补充：N11的实际内容、参与体验与承诺判断覆盖机会与资源类型，不限导师、实习或长期协作。P1按场景选考察维度，增加一个非导师／就业的验证案例与一个仅找入口即可结束的任务；既检查信息判断增量，也检查是否造成不必要负担。现有研究证据偏导师与实习，其他场景仍需补证据，不能因此宣称全场景已验证。

## P2–P3 实现准备

- 先设计发现页、结果页、详情与指导、个人候选页，使用 P1 样本。
- 区分导师／课题组、机构、机会、指导、个人收藏；不沿用讨论帖模型作为默认业务模型。
- 评估已有 Web、后端、数据库和契约工具是否值得复用；记录保留、修改、停用的理由，技术选型不先于需求。
- 首版认证与收藏保存方式按需要决定；公开浏览不默认要求校园身份。
- 把需求、页面、接口与验收任务对应起来，再拆成可独立交付的开发任务。
- 测试覆盖检索与筛选、未知条件、过期状态、关联指导、收藏保存和内容更新等关键行为；执行与改动相应的工程检查。

## 范围变更

论坛、校园身份、桌面端、复杂推荐等没有预留的必做阶段。加入功能需说明用户收益、已有替代、数据来源、维护成本及会延后什么；证据不足的功能保留为候选。

## 历史记录：旧 M 系列已退出执行计划

以下原文仅用于回看旧方案。其“当前阶段”“计划中”“必须”等文字均属于 2026-07-06 的历史计划，不产生现行任务或退出条件；与上述基线不一致时以上述基线为准。此重置只影响仓库内计划，未声称已修改远端 issue、PR 或其他任务。

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
