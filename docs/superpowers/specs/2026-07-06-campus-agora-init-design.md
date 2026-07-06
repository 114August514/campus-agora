# Campus Agora 初始化设计

## 背景

根目录的三个说明文件把项目定位收敛为一个校园公共讨论与资料沉淀平台。项目不应被实现为普通论坛空壳，而应从第一天起把“开放讨论”和“长期资料维护”作为工程边界来组织代码。

仓库名采用 `campus-agora`。`agora` 指向公共广场、讨论空间和知识交换场所，能呼应项目的开放公共性；`campus` 保留校园场景的直观识别。

## 目标

本次初始化要建立一个可协作、可测试、可持续扩展的工程框架：

- 前端使用 TypeScript 生态，保证 UI 迭代速度和类型约束。
- 前端依赖、脚本和锁文件使用 Bun 管理，减少 Node 工具链分歧。
- 后端使用 Rust 生态，保证领域模型、状态流转、权限和数据边界更严格。
- CI 同时覆盖前端和后端的格式、lint、测试与构建。
- 工具链版本固定在仓库内，避免本地和 CI 使用不同的 Bun、Rust 或 PostgreSQL 版本。
- 文档明确项目定位、开发命令、质量门禁和协作方式。
- 初始代码只实现工程可运行闭环和核心领域骨架，不提前实现完整论坛产品。

## 非目标

本次初始化不实现完整业务流程：

- 不直接接入真实校园统一认证；初始化只定义认证适配器接口、模拟校园认证 provider 和真实接入所需配置边界。
- 不接入真实 AI 服务。
- 不实现完整资料帖、讨论帖和后台审核 UI。
- 不引入复杂推荐、热榜、WebSocket 通知或数据大屏。
- 不把根目录三个临时说明文件改写为正式产品文档，除非后续另行整理。

## 选型

采用方案 1：

`React/Vite + Axum + SQLx + PostgreSQL`

理由：

- React/Vite 适合快速构建资料检索、发布编辑、讨论和管理后台等交互式页面。
- Axum 基于 Tower 生态，API 结构清晰，适合按路由、状态和中间件拆分。
- SQLx 保持 SQL 的明确性，同时提供编译期或离线校验能力，适合资料帖、版本历史、审核状态等强数据模型。
- PostgreSQL 适合全文检索、标签、版本记录、审计字段和后续权限扩展。

不选 Actix/Diesel 的原因是初始模型较多时工程心智负担更高。不选 Next.js 的原因是当前优先级是登录后社区应用和资料检索工具，SSR 不是 MVP 的关键收益。

## 仓库结构

初始化为 monorepo：

```text
campus-agora/
  apps/
    web/
      src/
      index.html
      package.json
      vite.config.ts
      tsconfig.json
  contracts/
    openapi.json
  crates/
    api/
      src/
      Cargo.toml
    domain/
      src/
      Cargo.toml
    db/
      src/
      migrations/
      Cargo.toml
  docs/
    ai-log/
      done.md
      todo.md
    api-contracts.md
    architecture.md
    auth-permissions.md
    development.md
    milestones.md
  .github/
    workflows/
      ci.yml
  AGENTS.md
  CONTRIBUTING.md
  Cargo.toml
  bun.lock
  package.json
  rust-toolchain.toml
  README.md
```

各部分职责：

- `apps/web`：浏览器端应用壳、页面路由、API 客户端和前端测试。
- `contracts`：前后端共享 API contract，初始使用 OpenAPI JSON。
- `crates/domain`：领域类型、状态枚举、输入校验和无需数据库的业务规则。
- `crates/db`：数据库连接、migration、repository 边界和 SQLx 类型。
- `crates/api`：HTTP 入口、路由、中间件、错误响应和依赖注入。
- `docs`：项目定位、架构说明、开发命令、AI LOG、里程碑和协作约定。

## 后端边界

后端 workspace 至少包含三个 crate：

- `campus_agora_domain`
- `campus_agora_db`
- `campus_agora_api`

初始化阶段先建立这些核心概念：

- `AuthProvider`：`MockCampus` 与后续真实校园认证 provider 的抽象边界。
- `UserRole`：系统级角色，例如 `Student`、`OrganizationMember`、`Moderator`、`Admin`。
- `ResourceRole`：资源级角色，例如 `Author`、`Maintainer`、`Reviewer`。
- `PostKind`：`Knowledge` 与 `Discussion`，区分资料帖和讨论帖。
- `ModerationStatus`：`Draft`、`PendingReview`、`Published`、`Rejected`、`Archived`。
- `KnowledgePostDraft`：资料帖草稿，包含标题、摘要、标签、适用对象、来源和维护者。
- `DiscussionPostDraft`：讨论帖草稿，包含标题、正文、标签和是否匿名。
- `RevisionMeta`：版本记录元信息，服务于“资料可维护”的核心定位。

API 初始化阶段提供：

- `GET /healthz`：健康检查。
- `GET /api/v1/meta`：返回应用名称、版本和核心能力开关。

这些接口用于建立端到端构建和测试闭环，后续再逐步补充资料帖、讨论帖、评论、审核和 AI 归档接口。

## 前后端接口边界

前后端接口必须作为一等工程资产维护，不能依赖手写重复类型或口头约定。

初始化阶段采用 OpenAPI 3.1 作为 contract 格式：

- `contracts/openapi.json`：提交到仓库的 API contract 快照。
- `crates/api`：使用 Rust DTO 和路由注解导出 OpenAPI；后端是 contract 的生成来源。
- `apps/web/src/api/generated.ts`：由 `contracts/openapi.json` 生成的 TypeScript 类型。
- `apps/web/src/api/client.ts`：基于生成类型封装前端请求函数，页面组件不直接拼接裸 `fetch`。
- `docs/api-contracts.md`：说明接口变更流程、生成命令和 breaking change 规则。

推荐工具链：

- Rust 后端使用 `utoipa` 描述 schema、response 和 route。
- 前端使用 `openapi-typescript` 生成类型。
- 前端请求封装使用轻量 fetch wrapper 或 `openapi-fetch`，保持请求和响应类型来自同一份 contract。

共享协议约定：

- JSON 字段名使用 `camelCase`。
- 枚举值使用小写 `snake_case`，例如 `pending_review`。
- 时间字段使用 UTC ISO 8601 字符串，例如 `2026-07-06T02:30:00Z`。
- ID 字段使用 UUID 字符串。
- 错误响应统一为 `ErrorResponse`：`code`、`message`、`requestId`、`details`。
- 列表分页统一为 `PaginatedResponse<T>`：`items`、`page`、`pageSize`、`totalItems`、`totalPages`。
- 写操作成功后返回资源当前状态，不只返回布尔值。
- 认证失败使用 `401`，权限不足使用 `403`，资源不存在使用 `404`，审核或状态流转冲突使用 `409`。
- 每个响应都应能通过日志或响应头关联 `requestId`，方便排查前后端对接问题。

接口变更流程：

1. 后端先更新 DTO、路由和 API 测试。
2. 重新导出 `contracts/openapi.json`。
3. 重新生成 `apps/web/src/api/generated.ts`。
4. 更新前端 API client 和组件调用。
5. CI 检查 contract、生成类型、后端测试和前端 typecheck 是否一致。

初始 CI 要包含 API contract 检查：

- `cargo run -p campus_agora_api --bin export-openapi -- contracts/openapi.json` 生成 contract。
- `bun run api:types` 根据 contract 生成前端类型。
- `git diff --exit-code contracts/openapi.json apps/web/src/api/generated.ts` 确认生成产物已提交。

破坏性接口变更必须在 PR 描述中说明影响范围。对已被前端使用的字段，优先新增字段或新增版本化 endpoint；只有初始化阶段未发布接口可以直接重命名或删除。

## 认证与权限边界

真实校园认证不放在 M0 或 M1 直接接入，原因是它依赖学校侧身份系统的外部条件，例如 CAS/OAuth/OIDC 协议、回调域名、测试账号、应用密钥、校内网访问策略和隐私合规要求。这些条件不属于仓库初始化阶段可以稳定控制的范围。

但 M1 必须完成真实接入前的工程边界：

- 定义 `AuthProvider` trait，隐藏具体身份来源。
- 提供 `MockCampusAuthProvider`，用于本地开发、CI 和比赛演示。
- 用户表保留 `auth_provider`、`provider_subject`、`campus_id_hash`、`verified_at` 等字段边界，避免后续真实接入时推翻模型。
- 真实校园认证后续作为 `CampusSsoAuthProvider` 或 `CampusOidcAuthProvider` 接入，只替换 provider，不重写业务权限。
- 不在数据库中保存明文校园卡号、身份证号或统一认证密码。

多用户权限必须从 M1 开始明确，并且以后端校验为准。前端可以隐藏按钮，但不能作为权限来源。

初始系统级角色：

- `Guest`：未登录用户，只能读取公开资料和公开讨论。
- `Student`：已通过模拟或真实校园认证的普通用户，可以发布讨论、提交资料草稿、评论、收藏、发起纠错。
- `OrganizationMember`：组织成员，可以维护所属组织资料、活动模板和组织主页内容。
- `Moderator`：板块或内容维护者，可以处理举报、审核草稿、标记精华、归档违规内容。
- `Admin`：系统管理员，可以管理角色、全局配置和高风险内容处置。

初始资源级角色：

- `Author`：内容创建者，可以编辑草稿和未进入审核后的自有内容。
- `Maintainer`：资料维护者，可以更新指定资料帖、处理纠错、发布新版本。
- `Reviewer`：审核者，可以通过或拒绝指定范围内的内容。

角色不是全局线性等级，不能使用未定义的“及以上”推断权限。权限必须由 action/resource 矩阵决定；系统角色、组织成员关系、资源角色和资源状态共同决定是否允许操作。

矩阵判定规则：

- `read_public` 对未登录用户开放，其余写操作都要求已认证用户。
- `Admin` 对管理类操作有系统级授权，但仍必须满足额外约束，例如不能移除最后一个管理员。
- 当 `Allowed resource roles` 为 `none` 时，只检查系统角色和额外约束。
- 当 `Allowed resource roles` 不为 `none` 时，用户必须拥有列出的系统角色之一，并拥有对应资源角色或满足额外约束中的组织/审核范围。
- 权限拒绝默认返回 `403`；资源不存在或用户不可见时返回 `404`，避免泄露私有资源存在性。

初始权限矩阵：

| Action | Resource | Allowed system roles | Allowed resource roles | Extra constraints | Audit |
| --- | --- | --- | --- | --- | --- |
| `read_public` | published post/comment | `Guest`, `Student`, `OrganizationMember`, `Moderator`, `Admin` | none | resource is public and published | no |
| `create_discussion` | discussion post | `Student`, `OrganizationMember`, `Moderator`, `Admin` | none | user is authenticated | no |
| `create_knowledge_draft` | knowledge post draft | `Student`, `OrganizationMember`, `Moderator`, `Admin` | none | user is authenticated | no |
| `edit_own_draft` | draft post | `Student`, `OrganizationMember`, `Moderator`, `Admin` | `Author` | post status is `Draft` or `Rejected` | no |
| `update_published_knowledge` | knowledge post | `Moderator`, `Admin` | `Maintainer` | update creates a new `post_revisions` row | yes |
| `maintain_organization_content` | organization post/page | `OrganizationMember`, `Moderator`, `Admin` | `Maintainer` | user belongs to the organization or has moderation scope | yes |
| `review_content` | pending post/comment | `Moderator`, `Admin` | `Reviewer` | reviewer scope matches board or organization | yes |
| `change_moderation_status` | post/comment | `Moderator`, `Admin` | `Reviewer` | transition must be valid for current status | yes |
| `manage_roles` | user/organization roles | `Admin` | none | cannot remove last admin | yes |

权限策略示例：

- 只有矩阵允许的已认证用户可以发布讨论和提交资料草稿。
- 只有 `Author` 或 `Maintainer` 可以编辑资料内容；已发布资料的更新必须形成 `post_revisions`。
- 只有 `Moderator` 或指定 `Reviewer` 可以改变审核状态。
- 匿名讨论仍绑定真实用户 ID，仅在公开展示层匿名；后台审核和风控必须可追溯。
- 组织资料必须由具备组织成员关系的 `OrganizationMember`、对应 `Maintainer`、`Moderator` 或 `Admin` 维护。
- `Admin` 操作必须写入审计事件。

权限实现原则：

- 权限判断集中在后端 policy 模块，避免散落在 handler 中。
- domain 层提供纯函数权限测试，API 层负责从 session 和资源加载上下文。
- 每个新增写操作 endpoint 必须有权限测试，至少覆盖允许、拒绝和资源不存在三类情况。
- `docs/auth-permissions.md` 记录角色、资源权限、匿名语义、审计要求和真实校园认证接入条件。

## 前端边界

前端初始化为一个真实应用壳，而不是营销页。首屏表达项目的产品工作台方向：

- 顶部导航包含资料库、讨论、归档助手、审核入口等一级入口占位。
- 主区域展示资料沉淀优先的搜索入口、最近更新资料和待整理讨论占位。
- 通过 API 客户端请求 `/api/v1/meta`，并展示后端状态或错误状态。

前端不会在初始化阶段实现完整业务交互，但要建立：

- TypeScript 严格模式。
- React 组件和测试样例。
- 由 OpenAPI 生成类型约束的 API 客户端封装。
- 基础样式和响应式布局。

## 数据库策略

初始化使用 PostgreSQL。`crates/db/migrations` 放置 SQLx migration。

数据库和 SQLx 校验策略：

- CI 使用 PostgreSQL 16 服务运行 migration smoke test。
- 后端测试在 CI 中设置 `DATABASE_URL`，至少验证 migration 可以应用到空库。
- 使用 SQLx query macros 时，必须提交 `.sqlx/` 离线元数据，并运行 `cargo sqlx prepare --workspace --check`。
- `.gitignore` 不能忽略 `.sqlx/`；SQLx 离线元数据属于可审查 contract。
- 如果某个 crate 暂时只使用运行时 SQL 或 migration 文件，仍要在 CI 运行 `sqlx migrate run`。
- 历史 migration 一旦进入主分支，不直接修改；新增 schema 变化必须追加 migration。

初始 migration 可以创建可演进的基础表：

- `users`
- `user_roles`
- `organizations`
- `organization_memberships`
- `posts`
- `post_maintainers`
- `post_revisions`
- `comments`
- `moderation_events`

表结构先覆盖 ID、创建/更新时间、用户身份来源、角色关系、帖子类型、审核状态、标题、正文、摘要、标签和版本号等通用字段。后续 AI 归档、附件、组织主页和可信度标签可以在独立 migration 中扩展。

## 质量门禁

根目录提供统一命令：

- `bun run lint`
- `bun run test`
- `bun run build`
- `bun run api:types`
- `bun run api:check`
- `bun run typecheck`
- `cargo fmt --all --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `cargo sqlx migrate run --source crates/db/migrations`
- `cargo sqlx prepare --workspace --check`

CI 在 GitHub Actions 中拆为前端和后端两个 job：

- 前端 job：安装 Bun，使用 `bun install --frozen-lockfile` 安装依赖，运行 api:types、typecheck、lint、test、build。
- 后端 job：安装固定 Rust toolchain，启动 PostgreSQL 16 服务，运行 fmt、clippy、test、migration smoke test、SQLx prepare check，并导出 OpenAPI contract。
- Contract job：确认 `contracts/openapi.json` 与 `apps/web/src/api/generated.ts` 没有未提交的生成差异。

工具链固定：

- `rust-toolchain.toml` 固定 Rust stable channel 和必要组件，例如 `rustfmt`、`clippy`。
- 根 `package.json` 使用 `packageManager` 声明 Bun 版本。
- GitHub Actions 使用同一 Bun 版本和 Rust toolchain。
- 本地开发文档明确 PostgreSQL 16 为默认数据库版本。
- Rust crate 在各自 `Cargo.toml` 统一使用 2021 edition，后续升级 edition 必须一次性更新 workspace。

Bun workspace 要求：

- 根 `package.json` 声明 `workspaces: ["apps/*"]`。
- 根脚本提供统一入口：`dev`、`build`、`test`、`lint`、`typecheck`、`api:types`、`api:check`。
- 根脚本通过 `bun --filter` 或显式 `--cwd apps/web` 调用前端子项目，避免协作者需要记住子目录命令。
- `apps/web/package.json` 只保留前端局部脚本和依赖，跨项目质量门禁从根目录执行。

本地协作文件：

- `.editorconfig`：统一换行、缩进和末尾换行。
- `.gitignore`：忽略构建产物、依赖目录、环境文件、覆盖率输出、临时目录、数据库 dump 和日志文件，但不忽略 `.sqlx/`。
- `.gitattributes`：声明 Git LFS 跟踪范围，只跟踪确实不适合进入普通 Git 历史的大型二进制资源。
- `CONTRIBUTING.md`：说明分支、提交、测试和 PR 前检查。
- `AGENTS.md`：说明后续 agent 或协作者在本仓库里的工作规范。
- `docs/ai-log/todo.md`：记录 agent 或协作者接下来要做的任务、来源、优先级、依赖和验收条件。
- `docs/ai-log/done.md`：记录已经完成的工作、提交、验证命令、关键决策和后续影响。
- `docs/lfs.md`：说明 Git LFS 的启用、检查和禁止滥用规则。
- `docs/api-contracts.md`：说明前后端接口 contract 的维护方式。
- `docs/auth-permissions.md`：说明认证 provider、角色、权限策略、匿名语义和审计要求。
- `docs/milestones.md`：说明项目推进阶段、交付物和退出条件。

## Git Ignore 与 LFS 策略

初始化阶段要同时提供可执行的 `.gitignore` 和 `.gitattributes`，而不是只写说明文档。

`.gitignore` 应覆盖：

- Rust 构建产物：`target/`。
- 前端依赖和构建产物：`node_modules/`、`apps/web/dist/`。
- Bun 本地缓存或调试输出。
- 测试覆盖率：`coverage/`、`apps/web/coverage/`。
- 环境变量：`.env`、`.env.*`，但保留 `.env.example`。
- 临时数据库 dump、日志文件和本地 scratch 文件。
- 编辑器、系统文件和临时目录。
- 不忽略 `.sqlx/`，因为使用 SQLx query macros 时它是需要提交的离线校验元数据。

Git LFS 只用于大型二进制资产，初始 `.gitattributes` 必须按路径限定，不能按全局扩展名捕获所有图片或字体。

初始 LFS 路径：

- `design/lfs/**`
- `assets/lfs/**`
- `docs/assets/lfs/**`

允许放入这些路径的内容：

- 设计源文件，例如 `.psd`、`.ai`、`.fig`。
- 大型图片、视频、字体、压缩包和模型文件。
- 不适合普通 Git diff 审查且超过项目约定大小阈值的二进制资源。

禁止默认把源码、Markdown、SQL migration、JSON、SVG、lockfile、小型 UI 图片、小型字体和配置文件放进 LFS。常规前端静态资源默认进入普通 Git；只有确实大到影响仓库体积或 diff 审查的资产才移动到 LFS 路径。

## 测试策略

初始化阶段要有最小但真实的测试闭环：

- Rust domain 单元测试验证帖子草稿校验和状态枚举。
- Rust domain 单元测试验证权限策略，例如作者编辑、维护者更新、审核者改状态、普通用户被拒绝。
- Rust API 测试验证健康检查和 meta 接口。
- Rust contract 测试验证 OpenAPI 导出包含初始化接口和响应 schema。
- 前端组件测试验证应用壳能渲染核心入口。
- 前端 API 客户端测试验证成功和失败响应处理。
- 前端类型生成检查验证 API client 没有偏离 `contracts/openapi.json`。

不在初始化阶段引入端到端浏览器测试。等真实发布、搜索和审核流程出现后再加入 Playwright。

## 协作规范

协作默认流程：

1. 新功能先补领域模型或 API 契约测试。
2. 后端变更必须跑 fmt、clippy、test。
3. 前端变更必须跑 typecheck、lint、test、build。
4. API 变更必须更新 OpenAPI contract、生成前端类型，并说明兼容性影响。
5. 权限相关变更必须更新 `docs/auth-permissions.md`，并补充后端 policy 测试。
6. 数据库结构变更必须新增 migration，不直接改历史 migration。
7. 由 agent 推进的非平凡任务必须更新 AI LOG：开始或发现任务时写入 `docs/ai-log/todo.md`，完成后写入 `docs/ai-log/done.md`。
8. 涉及内容治理、隐私、匿名和 AI 输出的变更必须在 PR 描述中说明风险边界。

## AI LOG 策略

初始化仓库时要提供 `docs/ai-log/todo.md` 和 `docs/ai-log/done.md`。它们不是替代 issue、milestone 或 commit history，而是给 AI agent 和人类协作者提供低摩擦的工作上下文。

`docs/ai-log/todo.md` 记录“要做什么”：

- 任务标题。
- 来源，例如用户请求、spec、CI 失败、代码审查或实现中发现的问题。
- 所属 milestone。
- 优先级。
- 阻塞条件。
- 验收条件。
- 当前状态，例如 `open`、`blocked`、`in progress`。

`docs/ai-log/done.md` 记录“做了什么”：

- 完成日期。
- 任务标题。
- 关联 milestone。
- 主要变更。
- 关键文件。
- 验证命令和结果。
- 相关提交 hash。
- 后续注意事项。

维护规则：

- AI LOG 只记录对项目推进有意义的任务，不记录每一次终端命令。
- 任务开始前，如果它不是当前对话里一眼可见的简单修改，应先在 `todo.md` 留一条可追踪记录。
- 任务完成后，把事实写进 `done.md`；已完成项可以从 `todo.md` 移除，或标记为完成并指向 `done.md`。
- 不能在 AI LOG 中写入密钥、账号、真实学生身份信息、内部认证回调地址或未脱敏日志。
- 记录必须短、可审查、可被后续 agent 继续执行；避免长篇复述对话。

## Milestone 策略

初始化仓库时要提供 `docs/milestones.md`，作为本地可审查的推进计划。后续如果启用 GitHub Issues，再把这些阶段同步为 GitHub Milestones；本地文档仍保留为项目事实来源，避免仓库脱离项目管理平台后丢失路线图。Milestone 管阶段目标，AI LOG 管任务流和执行事实。

初始里程碑：

- `M0 Repository Foundation`：完成 monorepo、Bun 前端、Rust workspace、OpenAPI contract、CI、lint、测试、`.gitignore`、`.gitattributes`、AI LOG、LFS 文档、权限文档和协作规范。退出条件是新成员能按 README 跑通前端、后端、测试和生成命令。
- `M1 Identity, Permissions And Shell`：完成认证 provider 抽象、模拟校园认证、用户模型、系统角色、资源角色、应用导航、登录态和基础权限边界。退出条件是前端能基于后端 API 完成登录态展示，后端有认证和权限策略测试。
- `M2 Knowledge Archive Core`：完成资料帖发布、编辑、标签、版本历史、纠错入口和基础列表。退出条件是一篇资料能从创建到更新再到版本追踪完整闭环。
- `M3 Discussion To Archive Loop`：完成讨论帖、评论、精华回复和从讨论沉淀到资料的工作流。退出条件是高质量评论能被引用或整理进资料帖。
- `M4 Moderation And AI Drafting`：完成基础审核后台、风险状态、AI 归档草稿和摘要生成占位接口。退出条件是 AI 结果必须可追溯、可编辑、可审核。
- `M5 Search And Demo Readiness`：完成全文搜索、收藏、引用、贡献展示和比赛演示脚本。退出条件是核心答辩路径可稳定演示，并通过完整 CI。
- `M6 Real Campus Identity Integration`：在拿到学校侧 CAS/OAuth/OIDC 接入条件后，完成真实校园认证 provider、回调配置、测试账号验证和隐私合规检查。退出条件是真实用户可通过校园身份登录，且业务权限无需重写。

每个 milestone 都要记录：

- 目标。
- 主要用户价值。
- 交付物。
- 明确不做的内容。
- 退出条件。
- 风险和需要确认的问题。

## 后续扩展顺序

初始化完成后，建议按以下顺序推进：

1. 用户登录与模拟校园认证。
2. 用户角色、资源角色和权限策略。
3. 资料帖发布、编辑、版本历史和纠错入口。
4. 讨论帖、评论和高质量回复归档。
5. 基础审核后台。
6. AI 一键归档草稿与摘要。
7. 全文搜索、收藏、引用和贡献展示。
8. 真实校园认证 provider 接入。
