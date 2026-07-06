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
- 文档明确项目定位、开发命令、质量门禁和协作方式。
- 初始代码只实现工程可运行闭环和核心领域骨架，不提前实现完整论坛产品。

## 非目标

本次初始化不实现完整业务流程：

- 不实现真实校园统一认证。
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
    api-contracts.md
    architecture.md
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
  README.md
```

各部分职责：

- `apps/web`：浏览器端应用壳、页面路由、API 客户端和前端测试。
- `contracts`：前后端共享 API contract，初始使用 OpenAPI JSON。
- `crates/domain`：领域类型、状态枚举、输入校验和无需数据库的业务规则。
- `crates/db`：数据库连接、migration、repository 边界和 SQLx 类型。
- `crates/api`：HTTP 入口、路由、中间件、错误响应和依赖注入。
- `docs`：项目定位、架构说明、开发命令、里程碑和协作约定。

## 后端边界

后端 workspace 至少包含三个 crate：

- `campus_agora_domain`
- `campus_agora_db`
- `campus_agora_api`

初始化阶段先建立这些核心概念：

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

初始 migration 可以创建可演进的基础表：

- `users`
- `posts`
- `post_revisions`
- `comments`
- `moderation_events`

表结构先覆盖 ID、创建/更新时间、帖子类型、审核状态、标题、正文、摘要、标签和版本号等通用字段。后续 AI 归档、附件、组织主页和可信度标签可以在独立 migration 中扩展。

## 质量门禁

根目录提供统一命令：

- `bun run lint`
- `bun run test`
- `bun run build`
- `bun run api:types`
- `bun run api:check`
- `cargo fmt --all --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`

CI 在 GitHub Actions 中拆为前端和后端两个 job：

- 前端 job：安装 Bun，使用 `bun install --frozen-lockfile` 安装依赖，运行 api:types、typecheck、lint、test、build。
- 后端 job：安装 Rust stable，运行 fmt、clippy、test，并导出 OpenAPI contract。
- Contract job：确认 `contracts/openapi.json` 与 `apps/web/src/api/generated.ts` 没有未提交的生成差异。

本地协作文件：

- `.editorconfig`：统一换行、缩进和末尾换行。
- `.gitignore`：忽略构建产物、依赖目录、环境文件、覆盖率输出、临时目录和 SQLx 本地缓存。
- `.gitattributes`：声明 Git LFS 跟踪范围，只跟踪确实不适合进入普通 Git 历史的大型二进制资源。
- `CONTRIBUTING.md`：说明分支、提交、测试和 PR 前检查。
- `AGENTS.md`：说明后续 agent 或协作者在本仓库里的工作规范。
- `docs/lfs.md`：说明 Git LFS 的启用、检查和禁止滥用规则。
- `docs/api-contracts.md`：说明前后端接口 contract 的维护方式。
- `docs/milestones.md`：说明项目推进阶段、交付物和退出条件。

## Git Ignore 与 LFS 策略

初始化阶段要同时提供可执行的 `.gitignore` 和 `.gitattributes`，而不是只写说明文档。

`.gitignore` 应覆盖：

- Rust 构建产物：`target/`。
- 前端依赖和构建产物：`node_modules/`、`apps/web/dist/`。
- Bun 本地缓存或调试输出。
- 测试覆盖率：`coverage/`、`apps/web/coverage/`。
- 环境变量：`.env`、`.env.*`，但保留 `.env.example`。
- SQLx 本地缓存：`.sqlx/`。
- 编辑器、系统文件和临时目录。

Git LFS 只用于大型二进制资产，初始 `.gitattributes` 建议覆盖：

- 设计源文件：`*.psd`、`*.ai`、`*.fig`。
- 大型图片：`*.png`、`*.jpg`、`*.jpeg`、`*.webp`、`*.avif`。
- 音视频和字体：`*.mp4`、`*.mov`、`*.webm`、`*.ttf`、`*.otf`、`*.woff`、`*.woff2`。
- 压缩包和模型文件：`*.zip`、`*.tar.gz`、`*.onnx`、`*.safetensors`。

禁止默认把源码、Markdown、SQL migration、JSON、SVG、lockfile 和小型配置文件放进 LFS。SVG 默认作为可审查文本资源进入普通 Git，除非后续明确存在大型生成 SVG 资产。

## 测试策略

初始化阶段要有最小但真实的测试闭环：

- Rust domain 单元测试验证帖子草稿校验和状态枚举。
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
5. 数据库结构变更必须新增 migration，不直接改历史 migration。
6. 涉及内容治理、隐私、匿名和 AI 输出的变更必须在 PR 描述中说明风险边界。

## Milestone 策略

初始化仓库时要提供 `docs/milestones.md`，作为本地可审查的推进计划。后续如果启用 GitHub Issues，再把这些阶段同步为 GitHub Milestones；本地文档仍保留为项目事实来源，避免仓库脱离项目管理平台后丢失路线图。

初始里程碑：

- `M0 Repository Foundation`：完成 monorepo、Bun 前端、Rust workspace、OpenAPI contract、CI、lint、测试、`.gitignore`、`.gitattributes`、LFS 文档和协作规范。退出条件是新成员能按 README 跑通前端、后端、测试和生成命令。
- `M1 Identity And Shell`：完成模拟校园认证、用户模型、应用导航、登录态和基础权限边界。退出条件是前端能基于真实 API 完成登录态展示，后端有认证相关测试。
- `M2 Knowledge Archive Core`：完成资料帖发布、编辑、标签、版本历史、纠错入口和基础列表。退出条件是一篇资料能从创建到更新再到版本追踪完整闭环。
- `M3 Discussion To Archive Loop`：完成讨论帖、评论、精华回复和从讨论沉淀到资料的工作流。退出条件是高质量评论能被引用或整理进资料帖。
- `M4 Moderation And AI Drafting`：完成基础审核后台、风险状态、AI 归档草稿和摘要生成占位接口。退出条件是 AI 结果必须可追溯、可编辑、可审核。
- `M5 Search And Demo Readiness`：完成全文搜索、收藏、引用、贡献展示和比赛演示脚本。退出条件是核心答辩路径可稳定演示，并通过完整 CI。

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
2. 资料帖发布、编辑、版本历史和纠错入口。
3. 讨论帖、评论和高质量回复归档。
4. 基础审核后台。
5. AI 一键归档草稿与摘要。
6. 全文搜索、收藏、引用和贡献展示。
