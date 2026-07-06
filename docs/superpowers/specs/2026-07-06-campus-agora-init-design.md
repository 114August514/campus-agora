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
- 不实现生产级自动备份、监控告警、对象存储、文件扫描、限流集群和 Tauri 自动更新；初始化只定义边界、配置占位和文档要求。
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
    web/                 # React/Vite 应用
    desktop/             # Tauri WebView 壳
  packages/
    api-client/          # TypeScript API client，前端唯一 HTTP 入口
  contracts/
    openapi.json         # 前后端共享 API contract 快照
  crates/
    domain/              # 纯领域模型、值对象、状态机、权限纯函数
    application/         # use case/service、业务流程、repository traits
    db/                  # SQLx、migration、DB row、repository 实现
    api/                 # Axum HTTP、DTO、routes、middleware、OpenAPI 导出
  docs/
    ai-log/
    api-contracts.md
    architecture.md
    auth-permissions.md
    backend.md
    desktop.md
    development.md
    deployment.md
    milestones.md
    operations.md
    security.md
  .github/
    workflows/
      ci.yml
  .dockerignore
  AGENTS.md
  CONTRIBUTING.md
  Cargo.toml
  Dockerfile.api
  bun.lock
  package.json
  rust-toolchain.toml
  README.md
```

各部分职责：

- `apps/web`：React/Vite Web UI，可在浏览器中运行，也可被 Tauri WebView 加载。
- `apps/desktop`：Tauri 桌面壳，负责系统 WebView、窗口配置、Tauri 权限和必要的本地 bridge。
- `packages/api-client`：浏览器和 Tauri WebView 可用的 TypeScript HTTP API client，由 OpenAPI contract 生成类型并封装请求；页面和 feature hooks 不直接裸 `fetch`。
- `contracts`：前后端共享 API contract，初始使用 OpenAPI JSON。
- `crates/domain`：领域类型、状态枚举、输入校验和无需数据库的业务规则。
- `crates/application`：业务用例、service、权限编排、事务意图和 repository trait；不依赖 Axum 或 SQLx 具体实现。
- `crates/db`：数据库连接、migration、数据库行模型、repository 实现和 SQLx 类型。
- `crates/api`：Axum HTTP 入口、路由、handler、DTO、中间件、错误响应、配置、观测、依赖注入和 OpenAPI 导出。
- `docs`：项目定位、架构说明、开发命令、AI LOG、里程碑和协作约定。

依赖方向必须单向：

```text
apps/web -> packages/api-client -> contracts/openapi.json
apps/desktop -> apps/web build output
crates/api -> crates/application -> crates/domain
crates/api -> crates/db
crates/db -> crates/application traits + crates/domain
```

禁止反向依赖：

- `crates/domain` 不依赖 `crates/application`、`crates/db`、`crates/api`、Axum、SQLx、Tauri 或 TypeScript。
- `crates/application` 不依赖 Axum DTO、SQLx row 或 Tauri command。
- `crates/db` 不依赖 Axum handler 或 API DTO。
- `apps/web` 不穿透导入 `packages/api-client/src/generated.ts`，只用 `packages/api-client` 公开出口。

M0 不创建 `packages/ui`、`packages/config` 或独立 `shared` 包。只有当出现第二个前端应用或真实跨应用复用需求时，再把 UI 或配置抽到 package；初始化阶段优先保持边界清晰而不是过度 monorepo 化。

## 后端边界

后端 workspace 至少包含四个 crate：

- `campus_agora_domain`
- `campus_agora_application`
- `campus_agora_db`
- `campus_agora_api`

后端按 Rust 服务器 API Server 维护，不把业务逻辑放在 Tauri 本地 command，也不把 Axum handler 写成脚本式入口。Tauri 只承载 WebView 和必要本机能力；资料、讨论、审核、权限和归档等业务默认通过 Rust API Server 暴露。

### 后端分层规范

后端采用清晰的服务器分层：

```text
Routes / Handlers
  Application Services / Use Cases
  Repository Traits
  Repository Implementations
  Database / External Services
```

各层职责：

- `routes`：只负责挂载路径、HTTP method、中间件和版本前缀。
- `handlers`：只负责解析 HTTP 输入、调用 service、把 service 结果转换为 DTO 响应，不写复杂业务规则，不直接拼 SQL。
- `application services`：负责业务流程编排、权限调用、状态流转、事务意图和跨 repository 的一致性。
- `repository traits`：位于 application 层，定义业务需要的数据访问能力，不暴露 SQLx 或数据库行模型。
- `repository implementations`：位于 db 层，负责数据库读写、SQLx 类型、查询条件和事务实现，不能处理 API DTO、HTTP 状态码或 UI 语义。
- `domain`：负责核心实体、枚举、值对象、校验、权限纯函数和状态机，不依赖 application、Axum、SQLx、Tauri 或前端类型。
- `infra` 或具体 adapter：后续接 Redis、对象存储、邮件、AI 服务和外部 API 时放入适配层，不让外部 SDK 污染 domain。

M0 使用四个 crate 表达这些边界：

- `crates/domain`：领域模型、权限 policy、状态流转和校验函数。
- `crates/application`：service/use case、repository trait、应用错误、事务接口和业务流程测试。
- `crates/db`：SQLx pool、migration、DB row model 和 repository trait 的 PostgreSQL 实现。
- `crates/api`：Axum app、DTO、handler、route、middleware、配置、错误映射、OpenAPI 导出和观测。

后端 crate 内部结构按职责保持小而清楚：

```text
crates/domain/src/
  auth.rs
  ids.rs
  permissions.rs
  posts.rs
  revisions.rs
  validation.rs

crates/application/src/
  errors.rs
  ports/
    repositories.rs
  services/
    meta_service.rs
  use_cases/
    mod.rs

crates/db/
  src/
    models/
    pool.rs
    repositories/
  migrations/

crates/api/src/
  app.rs
  config.rs
  dto/
  error.rs
  handlers/
  middleware/
  observability.rs
  routes/
  state.rs
```

`crates/application` 是业务流程边界，不是“第二个后端框架”。它让 CLI、background worker 或未来 admin API 可以复用同一批 use case，而不把业务绑死在 Axum handler 里。

### DTO、Domain、DB Model

后端禁止一个 Rust struct 到处复用。初始化阶段要明确三类类型：

- DTO：位于 `crates/api/src/dto`，只服务 API 请求、响应和 OpenAPI schema。
- Domain Model：位于 `crates/domain/src`，表达业务含义、状态和规则。
- DB Model / Row：位于 `crates/db/src/models`，只表达数据库查询结果和持久化结构。
- Application Types：位于 `crates/application/src`，表达 use case input/output、repository trait 和应用错误，不直接等同于 API DTO 或 DB row。

转换规则：

- API response 只能由 DTO 返回，不能直接 serialize DB row。
- DTO、application output、domain model 和 DB row 之间通过明确的转换函数或 `From/TryFrom` 实现转换，避免密码 hash、token、内部权限字段、审计字段或校园身份原始信息误返回给前端。
- JSON 字段命名遵守前后端契约，DTO 使用 `serde(rename_all = "camelCase")`；domain 和 DB 内部命名遵守 Rust 风格。
- DB row 可以包含数据库实现细节；domain model 不能被数据库字段形状绑死。
- API DTO 的 breaking change 必须走 OpenAPI contract 变更流程。

### 错误、配置与观测

错误模型分两层：

- `crates/application` 使用 `ApplicationError` 或等价类型表达 `Unauthorized`、`Forbidden`、`NotFound`、`Validation`、`Conflict`、`ExternalService` 等业务和应用错误。
- `crates/api` 使用 `AppError` 或等价类型把 application/db/config 错误映射为 HTTP 响应。
- HTTP 响应统一映射为 `ErrorResponse`，字段为 `code`、`message`、`requestId`、`details`。
- `code` 是前端和日志依赖的稳定错误码，使用小写 `snake_case`，例如 `unauthorized`、`forbidden`、`post_not_found`、`invalid_moderation_transition`。
- `message` 是面向用户或开发者的可读信息，不能作为前端分支判断依据。
- 内部错误、数据库错误和外部服务错误默认脱敏，不能把 SQL、secret、token、cookie、校园身份原始信息或完整敏感请求体返回给前端。

配置必须集中读取：

- `crates/api/src/config.rs` 定义 `AppConfig`，集中读取环境变量和 `.env`。
- 业务代码不得到处调用 `std::env::var`。
- 初始化阶段至少支持 `SERVER_HOST`、`SERVER_PORT`、`DATABASE_URL`、`CORS_ALLOWED_ORIGINS`、`RUST_LOG`、`REQUEST_BODY_LIMIT_BYTES`。
- 后续接入 Redis、session、对象存储、邮件、AI 服务或校园 SSO 时，只扩展 config 和 adapter，不在 handler 中硬编码。
- 仓库提供 `.env.example`，不提交真实 `.env`、secret、token 或学校侧回调密钥。

观测必须从 M0 开始：

- 使用 `tracing` 和 `tower-http` 记录结构化请求日志。
- 每个请求都有 `requestId`，优先透传 `X-Request-Id`，不存在时由后端生成。
- 日志至少包含 `requestId`、method、path、status、latency、error code；已登录后可记录脱敏 user id。
- 不记录密码、token、cookie、完整校园身份号、完整敏感请求体或私密文件内容。
- `/healthz` 表示进程存活，不依赖数据库。
- `/readyz` 表示服务可接流量，至少检查 PostgreSQL 连接；后续接 Redis 等依赖时纳入 ready check。

### 安全与部署边界

API Server 必须按长期运行服务维护：

- CORS 使用 allowlist，生产环境禁止 `Access-Control-Allow-Origin: *` 搭配 cookie/session。
- 使用 cookie session 时必须设计 CSRF 防护；使用 bearer token 时必须记录吊销和续期策略。
- 请求体大小必须有限制，避免无界 payload。
- SQL 查询通过 SQLx 参数绑定，不手写字符串拼接用户输入。
- 权限校验集中在 policy/service，不能只靠前端隐藏按钮。
- repository 查询必须包含用户可见性或权限范围条件，避免只按资源 ID 查询造成越权。
- 未来文件上传必须限制大小、类型、扫描策略和对象存储权限。
- 后续如支持密码登录，密码只能用 Argon2id 等密码 hash，不保存明文或可逆加密密码。

M0 不部署生产环境，但要提供可部署基础：

- `Dockerfile.api` 构建 Rust API Server。
- `.dockerignore` 排除 target、node_modules、dist、coverage、`.env` 和临时文件。
- `docs/deployment.md` 记录本地构建、migration、健康检查、staging/production 发布顺序和回滚原则。
- CI 至少验证 API Server 可以编译；如 Docker 可用，运行 `docker build -f Dockerfile.api .`。

后台任务不放入 M0 业务实现，但边界要提前明确：AI 归档、上传处理、通知、Webhook 重试、清理任务等长耗时工作不能长期阻塞 HTTP 请求。早期可以用受控 Tokio background task；复杂后再引入 Redis queue 或独立 worker。

### 系统运行与上线边界

初始化阶段不直接上线生产环境，但必须把“能上线、能排查、能恢复”的边界写进工程结构。项目整体按这些层次理解：

```text
Client Layer
  Web Client
  Tauri Client
  TypeScript API Client
API Layer
  REST API
  Auth Middleware
  Rate Limit
  Request ID
  Error Response
Backend Layer
  API Handlers
  Application Use Cases
  Repositories
  Domain Models
  Background Jobs
Data Layer
  PostgreSQL
  Redis, optional
  Object Storage, optional
  Search Index, optional
Ops Layer
  Logs
  Metrics
  Tracing
  Backup
  CI/CD
  Alerts
```

环境隔离：

- M0 提供 `.env.example`，列出 local/dev/staging/production 需要的配置项，但不提交真实 secret。
- local、dev、staging、production 必须使用独立数据库、Redis、对象存储 bucket、API domain、OAuth callback、日志等级和 secret。
- 不能让本地、测试和生产共享同一个 `DATABASE_URL`、session secret、校园认证回调密钥或对象存储凭据。
- `docs/deployment.md` 记录环境变量来源和部署顺序；`docs/operations.md` 记录各环境的用途、数据隔离规则和故障处理入口。

备份、恢复与数据修复：

- M0 不实现自动备份任务，但 `docs/operations.md` 必须定义 PostgreSQL 备份策略占位：备份频率、保留周期、恢复演练、负责人和恢复验收方式。
- 生产上线前必须有至少一次从备份恢复到隔离环境的演练记录。
- migration 必须先在 staging 执行并验证，再进入 production。
- 线上数据修复必须通过可审查脚本或 migration 完成，不能直接手工改生产库且不留记录。
- `docs/deployment.md` 必须说明 migration 失败时的回滚或前滚策略。

观测、监控与告警：

- M0 只要求结构化日志、requestId 和健康检查；metrics、dashboard、alert 可以先作为文档化接入点。
- 后端日志至少保留 method、path、status、latency、requestId、error code；后续登录后可记录脱敏 user id。
- 数据库耗时、外部服务耗时、高成本 AI 任务耗时和后台任务状态必须在对应功能落地时加入 tracing span。
- `docs/operations.md` 必须列出上线前需要接入的基础指标：5xx rate、p95 latency、数据库连接池、migration 状态、队列积压、磁盘/存储、登录失败率。
- 生产上线前必须定义告警入口、告警级别和最小 runbook：服务不可用、数据库不可用、migration 失败、错误率升高、存储不可写、Tauri 更新失败。

配置与密钥管理：

- 配置通过环境变量注入，代码中不能硬编码 secret、域名、校园认证回调密钥或对象存储凭据。
- `docs/security.md` 记录 secret 分类、轮换策略、泄露处理流程和本地开发替代值。
- `.gitignore` 必须忽略 `.env` 和 `.env.*`，但保留 `.env.example`。
- CI secret 只能来自 GitHub Actions secrets 或后续部署平台 secret，不写入 workflow 明文。

速率限制与滥用防护：

- M0 不需要实现 Redis rate limiter，但 API 层必须预留 middleware 边界。
- 登录、模拟认证、搜索、上传、AI 归档、邮件/通知、API key 和高成本接口必须在对应 milestone 落地前定义限流策略。
- 限流维度至少考虑 IP、用户、资源、API key 和 endpoint。
- 触发限流统一返回 `429` 和稳定错误码，例如 `rate_limited`。

文件上传、对象存储与下载安全：

- M0 不实现附件上传，但资料沉淀平台后续很可能需要文件能力，因此必须预留对象存储 adapter 边界。
- 文件上传必须先定义大小限制、类型限制、权限校验、对象 key 命名、临时签名 URL、删除策略和版本策略。
- 用户上传文件不能默认公开可访问；下载必须重新走权限校验或短期签名 URL。
- 文件扫描、恶意内容处理和版权/隐私风险在真实上传功能进入 milestone 前必须写入 `docs/security.md`。

Tauri 桌面端安全：

- Tauri v2 capabilities/permissions 必须按窗口和能力最小授权。
- M0 禁止开放 shell command、任意文件系统访问和未说明用途的系统能力。
- 如果后续需要文件选择、剪贴板、通知、打开外部链接、自动更新或本地缓存，必须先在 `docs/desktop.md` 记录用途、风险、权限和测试方式。
- Tauri token、本地缓存和自动更新签名策略必须在真实登录或发布前明确。

发布、版本和回滚：

- Web 前端、Rust API Server、数据库 migration 和 Tauri 客户端版本必须分别记录发布顺序。
- 生产发布流程默认是：build -> staging deploy -> migration -> health/readiness check -> production deploy -> smoke test。
- Tauri 自动更新不属于 M0，但 `docs/desktop.md` 要预留版本号、签名和回滚说明位置。
- `docs/deployment.md` 必须记录失败后如何回滚前端、后端、migration 和桌面版本。

前端产品状态：

- 每个核心页面必须考虑 loading、empty、error、unauthorized、forbidden、offline、retrying 和 partial failure。
- Tauri 桌面端还要考虑服务器不可用、网络断开、token 过期、本地缓存过期和后台同步失败。
- 基础状态组件由 `components/ui` 提供，页面不得各自手写一套加载、错误、权限不足和离线状态。

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

- `GET /healthz`：liveness 健康检查，只证明进程存活。
- `GET /readyz`：readiness 健康检查，至少证明 PostgreSQL 可连接。
- `GET /api/v1/meta`：返回应用名称、版本和核心能力开关。

这些接口用于建立端到端构建和测试闭环，后续再逐步补充资料帖、讨论帖、评论、审核和 AI 归档接口。

## 前后端接口边界

前后端接口必须作为一等工程资产维护，不能依赖手写重复类型或口头约定。

初始化阶段采用 OpenAPI 3.1 作为 contract 格式：

- `contracts/openapi.json`：提交到仓库的 API contract 快照。
- `crates/api`：使用 Rust DTO 和路由注解导出 OpenAPI；后端是 contract 的生成来源。
- `packages/api-client/src/generated.ts`：由 `contracts/openapi.json` 生成的 TypeScript 类型。
- `packages/api-client/src/request.ts`：基于生成类型封装浏览器和 Tauri WebView 端请求函数、错误归一化、认证策略和 requestId 透传。
- `packages/api-client/src/*.ts`：按资源封装业务友好的 API client 方法，例如 `meta.ts`、后续 `posts.ts`、`auth.ts`。
- `apps/web`：只从 `@campus-agora/api-client` 调用 HTTP API，不直接依赖 generated types。
- `docs/api-contracts.md`：说明接口变更流程、生成命令和 breaking change 规则。

推荐工具链：

- Rust 后端使用 `utoipa` 描述 schema、response 和 route。
- 前端使用 `openapi-typescript` 生成类型。
- 前端请求封装使用轻量 fetch wrapper 或 `openapi-fetch`，保持请求和响应类型来自同一份 contract。

### 路径、参数与响应规范

REST API 路径统一使用：

- 业务 API 前缀为 `/api/v1`。
- 资源路径使用复数名词和 kebab-case，例如 `/api/v1/knowledge-posts`、`/api/v1/discussion-posts`、`/api/v1/moderation-events`。
- 动作优先用 HTTP method 表达：`GET` 读取、`POST` 创建、`PATCH` 局部更新、`DELETE` 删除或归档。
- 不在路径中使用 `/getXxx`、`/createXxx`、`/delete_xxx`、`/listAll` 这类动词式命名。
- `/healthz`、`/readyz` 和 OpenAPI 导出不放在 `/api/v1` 下。

参数位置固定：

- Path 参数只放资源 ID，例如 `/api/v1/knowledge-posts/{postId}`。
- Query 参数放分页、筛选、排序和搜索，例如 `page`、`pageSize`、`sort`、`q`、`tag`、`status`。
- Request body 放复杂输入，例如创建草稿、更新资料、提交审核。
- Header 放认证、语言、request id 和幂等键，例如 `Authorization`、`Accept-Language`、`X-Request-Id`、`Idempotency-Key`。

列表接口统一使用 page pagination：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 135,
  "totalPages": 7
}
```

筛选和排序规则：

- `page` 从 1 开始。
- `pageSize` 默认 20，最大值由后端配置限制。
- `sort` 使用 `field:direction`，例如 `createdAt:desc`。
- 多条件筛选使用重复 query 参数或明确命名参数，不把 JSON 字符串塞进 query。
- 大数据量或无限滚动场景后续可以新增 cursor pagination，但不能和 page pagination 混在同一个 endpoint 响应结构里。

### 共享协议约定

- JSON 字段名使用 `camelCase`。
- 枚举值使用小写 `snake_case`，例如 `pending_review`。
- 时间字段使用 UTC ISO 8601 字符串，例如 `2026-07-06T02:30:00Z`。
- ID 字段使用 UUID 字符串。
- 错误响应统一为 `ErrorResponse`：`code`、`message`、`requestId`、`details`；前端只能依赖稳定 `code` 分支，不依赖 `message`。
- 错误码使用小写 `snake_case`，并在 `docs/api-contracts.md` 中维护语义，例如 `unauthorized`、`forbidden`、`validation_failed`、`post_not_found`、`invalid_moderation_transition`。
- 列表分页统一为 `PaginatedResponse<T>`：`items`、`page`、`pageSize`、`totalItems`、`totalPages`。
- 写操作成功后返回资源当前状态，不只返回布尔值。
- 参数格式错误使用 `400`，未认证使用 `401`，权限不足使用 `403`，资源不存在或不可见使用 `404`，状态或唯一性冲突使用 `409`，业务校验失败使用 `422`，请求过快使用 `429`，未预期服务端错误使用 `500`。
- 每个响应都应能通过 `X-Request-Id` 响应头和 body 中的 `requestId` 关联后端日志，方便排查前后端对接问题。
- `/healthz` 和 `/readyz` 不放在 `/api/v1` 下；业务 API 必须使用 `/api/v1` 前缀。

### 认证与会话对接

M0 不接真实校园认证，但 API contract 必须提前表达认证边界：

- 公共读取接口明确标注 `security: []` 或等价 OpenAPI 语义。
- 需要登录的接口必须在 OpenAPI 中标注认证要求。
- Web 浏览器默认优先支持 cookie/session 策略，后续需要 CSRF 防护。
- Tauri WebView 可以使用 bearer token 策略，但长期 token 不能明文落在 WebView localStorage；token 存储、刷新、吊销和退出清理必须写入 `docs/auth-permissions.md`。
- `401` 表示未登录或登录态失效；前端 API client 负责归一化为 `AuthRequired` 类错误，应用层决定跳转登录或弹出登录入口。
- `403` 表示已登录但无权限；前端不能自动重试或静默降级为未登录。

### API Client 分层

`packages/api-client` 采用三层：

- `generated.ts`：由 OpenAPI 生成，只能由生成命令改动。
- `request.ts`：统一处理 baseUrl、headers、JSON、认证策略、requestId、超时/取消、错误归一化和 HTTP 状态码。
- resource client：按资源导出业务方法，例如 `getMeta()`、`getHealth()`、后续 `listKnowledgePosts()`、`createKnowledgeDraft()`。

`apps/web` 使用方式：

- `apps/web/src/lib/api.ts` 创建 `createCampusAgoraApiClient()` 实例，读取 `VITE_API_BASE_URL`。
- `apps/web/src/features/*/hooks` 使用 API client 和请求状态管理。
- `pages` 只组合 feature hooks 和 UI 组件，不直接调用裸 `fetch`。
- `apps/web` 不能导入 `packages/api-client/src/generated.ts`；如需类型，由 `@campus-agora/api-client` 公开出口导出稳定类型。

接口变更流程：

1. 后端先更新 DTO、路由和 API 测试。
2. 重新导出 `contracts/openapi.json`。
3. 重新生成 `packages/api-client/src/generated.ts`。
4. 更新 `packages/api-client/src/request.ts`、resource client 和 `apps/web` feature hooks。
5. CI 检查 contract、生成类型、后端测试和前端 typecheck 是否一致。

### Mock 与联调流程

前后端可以并行开发，但必须以 contract 为边界：

- 后端未完成时，前端可以使用 MSW 或等价 mock server，但 mock handler 必须基于 `packages/api-client` 公开类型，不手写另一套类型。
- mock 数据放在 `apps/web/src/features/*/__mocks__` 或集中 `apps/web/src/mocks`，不能混进生产 API client。
- CI 至少运行 API client 单元测试，覆盖成功响应、错误响应、401、403、404、409、422 和 requestId。
- 联调时先确认 `contracts/openapi.json` 已更新，再排查前端调用；不要用临时字段绕过 contract。
- `docs/api-contracts.md` 必须记录本地后端、mock 模式和 Tauri WebView 连接本地 API 的命令。

初始 CI 要包含 API contract 检查：

- `cargo run -p campus_agora_api --bin export-openapi -- contracts/openapi.json` 生成 contract。
- `bun run api:types` 根据 contract 生成前端类型。
- `git diff --exit-code contracts/openapi.json packages/api-client/src/generated.ts` 确认生成产物已提交。

### 版本、废弃与实时消息

破坏性接口变更必须在 PR 描述中说明影响范围。对已被前端使用的字段，优先新增字段或新增版本化 endpoint；只有初始化阶段未发布接口可以直接重命名或删除。

以下变更都视为 breaking change：

- 删除字段。
- 改字段名。
- 改字段类型。
- 改错误 `code`。
- 改分页结构。
- 改认证要求。
- 改 HTTP status 语义。

长期维护规则：

- 新增字段通常兼容，但前端不能依赖未进入 contract 的字段。
- 废弃字段先在 OpenAPI description 中标记 deprecated，并在 `docs/api-contracts.md` 记录迁移窗口。
- 大范围破坏性变更新增 `/api/v2`，不在 v1 内静默改变语义。

M0 不实现 WebSocket。后续若引入通知、任务进度、聊天或 AI 归档进度，消息必须使用统一 envelope：

```json
{
  "type": "task.progress",
  "payload": {},
  "requestId": "req_abc123",
  "correlationId": "job_123",
  "timestamp": "2026-07-06T02:30:00Z"
}
```

WebSocket 消息类型也必须进入 contract 文档，不能发送无类型散 JSON。

## Tauri WebView 与 TypeScript API Client

初始化阶段要提供 Tauri WebView 桌面壳和独立的 `packages/api-client`。Tauri WebView 负责承载 `apps/web` 的前端界面；`packages/api-client` 负责访问 Axum HTTP API。二者不能混成一个概念。

Tauri WebView 边界：

- `apps/desktop` 使用 Tauri 加载 `apps/web` 的开发服务器或构建产物。
- `apps/desktop/src-tauri` 只处理窗口、权限、本地系统能力和少量必须在本机执行的 command。
- Tauri command 不承载资料帖、讨论帖、审核等领域业务；领域业务默认通过 Axum HTTP API 暴露。
- WebView 中不能保存长期密钥；认证状态以 cookie 或短期 token 策略为准，并在 `docs/auth-permissions.md` 中记录。
- Tauri 权限采用最小授权，`capabilities/default.json` 只开启初始化阶段实际需要的能力。
- 如果后续需要文件选择、系统通知或剪贴板等能力，先在 `docs/desktop.md` 记录用途、权限和风险，再增加 Tauri command。

TypeScript API client 职责：

- 从 `contracts/openapi.json` 生成 TypeScript 类型。
- 暴露 `createCampusAgoraApiClient(options)`，接收 `baseUrl`、可选 `fetch` 实现、认证 token/cookie 策略、requestId 策略和请求追踪配置。
- 统一处理 `ErrorResponse`、HTTP 状态码、JSON 解析、请求取消和 `requestId`。
- 导出业务友好的 resource 方法，例如 `getMeta()`、`getHealth()`、`getReadiness()`，而不是让页面层直接拼 path。
- 把 `401`、`403`、`404`、`409`、`422`、`429` 和网络失败归一化成稳定错误类型。
- 保持 browser/WebView-safe，不依赖 Node-only API 或 Tauri-only API。

边界：

- `packages/api-client` 不持有 React 状态，不依赖 React。
- `packages/api-client` 不调用 Tauri command；需要本地系统能力时由 `apps/web` 通过受控 bridge 调用 `apps/desktop/src-tauri` 暴露的 command。
- `apps/web` 可以在 feature hooks 或 data loaders 中调用 API client，但不能绕过它直接调用 HTTP endpoint。
- 未来如果增加 admin web、mobile web 或文档演示页，默认复用同一个 API client。

测试：

- API client 单元测试要覆盖成功响应、`ErrorResponse`、网络失败、401、403、404、409、422、429、认证策略和 requestId 透传。
- Tauri shell 初始测试至少运行 `cargo check`，并检查权限配置文件存在且不授予未使用能力。
- API contract 变更必须先更新 generated types，再调整 API client 方法。

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
- domain 层提供纯函数权限测试，application 层负责把 session、资源和权限上下文编排成 use case，API 层只负责从请求中提取身份并调用 use case。
- 每个新增写操作 endpoint 必须有权限测试，至少覆盖允许、拒绝和资源不存在三类情况。
- `docs/auth-permissions.md` 记录角色、资源权限、匿名语义、审计要求和真实校园认证接入条件。

## 前端边界

前端初始化为一个真实应用壳，而不是营销页。首屏表达项目的产品工作台方向：

- 顶部导航包含资料库、讨论、归档助手、审核入口等一级入口占位。
- 主区域展示资料沉淀优先的搜索入口、最近更新资料和待整理讨论占位。
- 通过 `@campus-agora/api-client` 请求 `/api/v1/meta`，并展示后端状态或错误状态。

前端不会在初始化阶段实现完整业务交互，但要建立：

- TypeScript 严格模式。
- React 组件和测试样例。
- 由 OpenAPI 生成类型约束的 API client package。
- TanStack Query 或等价 server-state 管理边界；M0 至少为 `/api/v1/meta` 建立可测试 hook。
- 基础样式和响应式布局。

## 前端视觉系统与组件系统

`apps/web` 必须优先维护一套视觉系统和组件系统，页面层不直接手画重复 UI。

目录结构：

```text
apps/web/src/
  app/
    App.tsx
    providers.tsx
    router.tsx
  styles/
    tokens.css
    themes.css
    globals.css
  components/
    ui/
      Badge.tsx
      Button.tsx
      Card.tsx
      Checkbox.tsx
      Drawer.tsx
      Dropdown.tsx
      EmptyState.tsx
      IconButton.tsx
      Input.tsx
      LoadingState.tsx
      Modal.tsx
      Select.tsx
      Switch.tsx
      Tabs.tsx
      Textarea.tsx
      Toast.tsx
      Tooltip.tsx
    layout/
      Sidebar.tsx
      Topbar.tsx
      AppShell.tsx
    icons/
  features/
    meta/
      hooks/
      model/
      ui/
    design-system/
      DesignSystemPage.tsx
  pages/
    HomePage.tsx
  hooks/
  lib/
    api.ts
    env.ts
    format.ts
```

### 目录职责

- `app`：应用根、router、providers 和全局错误边界，不放业务页面实现。
- `styles/tokens.css`：集中定义颜色、间距、字号、圆角、阴影、边框、z-index、动效时长等设计 token。
- `styles/themes.css`：定义 light/dark 或后续主题变量，只覆盖 token 值，不写组件选择器。
- `styles/globals.css`：放 reset、基础排版、body/root 样式和全局可访问性样式。
- `components/ui`：提供基础可组合组件，页面不得重复实现按钮、输入框、弹窗、卡片、状态提示等基础 UI。
- `components/layout`：提供 `AppShell`、`Sidebar`、`Topbar` 等应用框架组件。
- `components/icons`：封装项目使用的 icon 出口，统一 Lucide 配置。
- `features`：按业务能力组织 hooks、局部 UI、model 和测试，例如 `meta`、后续 `auth`、`knowledge`、`discussion`、`moderation`。
- `pages`：只负责路由级页面组合，不承载基础 UI 样式实现，不直接裸 `fetch`。
- `hooks`：放可复用 React hooks。
- `lib`：放 API client 实例、环境变量读取、格式化函数和非 React 业务辅助函数。

前端依赖方向：

```text
app -> pages -> features -> packages/api-client
pages -> components/layout + components/ui
features -> components/ui
components/ui -> styles + components/icons
```

禁止：

- `components/ui` 依赖 feature、page、API client 或路由。
- `pages` 直接导入 `packages/api-client/src/generated.ts`。
- `pages` 直接裸 `fetch`。
- feature 间互相穿透内部目录；跨 feature 复用先提升到 `lib`、`hooks` 或明确的公开出口。

### Design Tokens

`tokens.css` 要把视觉基础变量集中维护，页面和组件必须通过 CSS custom properties 使用这些 token，不在页面中散落魔法值。

Token 至少覆盖：

- 颜色：`bg`、`surface`、`elevated`、`text`、`text-muted`、`text-disabled`、`border`、`border-strong`、`primary`、`primary-hover`、`primary-active`、`success`、`warning`、`danger`、`info`、`hover`、`active`、`selected`、`focus`。
- 字号：`12px`、`14px`、`16px`、`20px`、`24px`，后续大标题如确有需要可以增加 `28px`，但不能在页面中随手新增 13px、15px、17px 等散值。
- 字重：`400` 用于正文，`500` 用于按钮、菜单和强调文本，`600` 用于标题，`700` 只用于少量强强调。
- 间距：采用 4px 系统，至少提供 `4px`、`8px`、`12px`、`16px`、`24px`、`32px`、`48px`。组件内部小间距使用 4/8/12，组件 padding 使用 12/16/24，区块之间使用 24/32，页面大分区使用 40/48。
- 圆角：控件默认 `8px` 以内，卡片默认不超过 `8px`，浮层和弹窗可以使用 `12px` 或 `16px`，不得为同类组件随手设置新圆角。
- 阴影：默认组件不使用阴影，主要靠边框和层级区分；dropdown、tooltip、toast、modal 等浮层使用轻到中等阴影。
- 动效：普通 hover 使用 `150ms`，浮层使用 `200ms`，页面局部切换使用 `200-300ms`，缓动统一使用 `ease-out` 或项目 token 中定义的 cubic-bezier。
- 层级：为 dropdown、popover、toast、modal、drawer 定义明确 z-index token，禁止组件各自硬编码层级。

颜色体系必须克制：大面积使用中性色，小面积使用品牌色；危险操作只使用 danger，成功状态只使用 success，警告状态只使用 warning。不能为每个功能随意新增语义不明的颜色。

### 主题与样式技术

初始化阶段默认采用 CSS variables + CSS Modules 管住样式：

- `tokens.css` 定义 token 名称和默认值。
- `themes.css` 通过 `data-theme="light"` 和 `data-theme="dark"` 覆盖 token 值。
- 组件样式放在组件同目录或 `styles` 中的 CSS Module，组件通过 class 组合 token。
- 暂不把 Tailwind 作为 M0 默认依赖；如果后续引入 Tailwind，必须把 Tailwind theme 映射到同一套 CSS variables，并通过 lint/review 禁止常态化使用 arbitrary values，例如 `rounded-[13px]`、`p-[17px]`、`bg-[#181818]`。

Stylelint 要约束样式质量：

- 禁止页面级 CSS 使用裸十六进制颜色、散乱 px 值和负 `letter-spacing`。
- 允许在 `tokens.css` 和 `themes.css` 中定义 token 原始值。
- 页面样式只能用于局部排版和组合，不能重新定义基础控件视觉。
- 组件状态样式必须覆盖 hover、active、focus-visible、disabled、loading、selected/active、error、success 和 empty 中适用的状态。

### 组件规范

M0 至少建立这些基础组件或明确占位：

- 操作：`Button`、`IconButton`。
- 表单：`Input`、`Textarea`、`Select`、`Checkbox`、`Switch`。
- 反馈：`Toast`、`Tooltip`、`Badge`、`LoadingState`、`EmptyState`。
- 浮层：`Modal`、`Drawer`、`Dropdown`。
- 导航与组织：`Tabs`、`Card`。
- 布局：`AppShell`、`Sidebar`、`Topbar`。

组件要求：

- `Button` 至少支持 `primary`、`secondary`、`ghost`、`danger` variant，并覆盖 default、hover、active、disabled、loading、focus-visible 状态。
- `Input` 和表单组件至少覆盖 default、hover、focus-visible、error、disabled 状态，错误文案由调用方传入，但视觉由组件统一。
- `Modal` 和 `Drawer` 使用统一 overlay、焦点管理和关闭语义，不能由页面临时拼接。
- `Toast` 统一 success、warning、danger、info 样式和动效。
- `Card` 只作为独立内容单元、列表项或工具面板使用，不作为页面区块的通用包裹层，也不嵌套卡片。
- `EmptyState` 和 `LoadingState` 使用统一 icon、文案密度和操作按钮位置，避免每个页面各写一套空状态。
- 基础组件不绑定具体业务 API；业务页面通过 props、children 和 hooks 组合它们。

### 图标规范

- 图标使用 `lucide-react`。
- 图标默认使用 rounded outline 风格，`strokeWidth={2}`，尺寸默认 `20px` 或由组件显式传入。
- 禁止在页面中手写 SVG 图标；新图标必须从 `components/icons` 导出。
- 所有可点击图标按钮必须有可访问名称，必要时使用 `aria-label`。
- ESLint 要限制 `lucide-react` 的直接导入范围：只有 `components/icons` 可以直接导入 Lucide 图标，其他代码从项目 icon 出口使用。

### 页面布局规范

Tauri/Web 桌面客户端采用固定应用壳：

```text
AppShell
  Sidebar
  Topbar / Toolbar
  Main Content
  Toast Layer
```

页面布局使用 `AppShell` 和 layout 组件组合，不在页面中重复写侧边栏、顶栏和主内容框架。

常见页面模板：

- 列表页：标题、操作按钮、筛选区、表格或列表、分页。
- 详情页：返回按钮、标题区、信息区、操作区。
- 设置页：左侧设置导航、右侧表单项。
- 空状态：统一 icon、标题、描述和主操作按钮。
- 设计系统页：`/design-system` 展示颜色、字体、按钮、输入框、卡片、弹窗、图标、空状态、加载状态和错误状态。

页面不得通过大面积 hero、营销说明或装饰背景替代真实工作台。首屏必须是可扩展的产品工作区，保留资料库、讨论、归档助手和审核入口的结构位置。

### 文案规范

UI 文案默认使用中文，避免在同一工作流中混用 `Save`、`OK`、`完成`、`提交` 等风格不一致的表达。

基础动词统一：

- 保存、取消、删除、复制、导出、重试、了解更多。
- 危险操作文案必须明确对象，例如“删除资料”优于“删除”。
- 错误提示说明可行动原因，例如“保存失败，请检查网络后重试。”、“文件格式不支持。”、“该名称已存在，请换一个名称。”。

文案不使用夸张语气、玩笑式错误提示或过度拟人化表达。工具类产品优先清晰、克制、可执行。

### 代码约束

- `components/ui` 组件必须是受控、可组合、可测试的基础组件，不绑定具体业务 API。
- `components/layout` 可以依赖路由和当前用户展示状态，但不直接发起后端写操作。
- `features` 负责业务 hooks、server-state 查询、局部 UI 和 feature 测试；跨 feature 共享逻辑先进入 `lib` 或 `hooks`。
- `pages` 可以调用 feature hooks 和组合组件，但不能直接导入 `packages/api-client/src/generated.ts`。
- `pages` 不能直接调用裸 `fetch`；HTTP 请求通过 feature hooks 和 `@campus-agora/api-client` 进入。
- 新增页面前优先复用已有 `ui` 和 `layout` 组件；确实需要新 UI primitive 时先加入 `components/ui`。
- 页面级样式只允许写组合布局、页面特有 grid/flex 和局部响应式约束；颜色、字号、间距、圆角、阴影必须来自 token。
- 新增 token 必须先说明语义和使用场景，不能因为单个页面“看起来差一点”临时加散值。
- 初始 CI 要对前端运行 typecheck、ESLint、Stylelint、unit tests 和 build，并通过规则或 review 检查页面中没有手写重复基础控件。
- `docs/development.md` 要记录 app/features/components 组织、API client 使用、mock 模式、组件新增规则、icon 使用方式、token 修改流程、Style Guide 页面维护方式和 UI 文案约定。

## 数据库策略

初始化使用 PostgreSQL。`crates/db/migrations` 放置 SQLx migration。

数据库和 SQLx 校验策略：

- CI 使用 PostgreSQL 16 服务运行 migration smoke test。
- 后端测试在 CI 中设置 `DATABASE_URL`，至少验证 migration 可以应用到空库。
- 使用 SQLx query macros 时，必须提交 `.sqlx/` 离线元数据，并运行 `cargo sqlx prepare --workspace --check`。
- `.gitignore` 不能忽略 `.sqlx/`；SQLx 离线元数据属于可审查 contract。
- 如果某个 crate 暂时只使用运行时 SQL 或 migration 文件，仍要在 CI 运行 `sqlx migrate run`。
- 历史 migration 一旦进入主分支，不直接修改；新增 schema 变化必须追加 migration。
- 新增字段要明确 nullable、默认值、回填和兼容策略；删除字段要分阶段完成，先停止读写，再迁移数据，最后删除。
- 索引必须跟随实际查询模式设计，尤其是 `owner_id`、`organization_id`、`post_kind`、`moderation_status`、`created_at`、`updated_at`、标签和全文检索字段。
- 需要一致性的写操作必须由 application use case 声明事务边界，并由 db repository 实现事务，例如发布资料版本时同时写 `posts`、`post_revisions` 和审计事件。
- repository 查询不能只按资源 ID 查询私有资源；必须同时带上可见性、组织范围、作者、维护者或审核范围条件，避免越权访问。
- DB row 类型不能直接作为 API response 返回。

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
- `bun run lint:styles`
- `cargo fmt --all --check`
- `cargo check --workspace --all-targets`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `cargo sqlx migrate run --source crates/db/migrations`
- `cargo sqlx prepare --workspace --check`
- `cargo run -p campus_agora_api --bin export-openapi -- contracts/openapi.json`

部署镜像检查命令：

- `docker build -f Dockerfile.api .`

CI 在 GitHub Actions 中拆为前端、后端、桌面、contract 和 container job：

- 前端 job：安装 Bun，使用 `bun install --frozen-lockfile` 安装依赖，运行 api:types、typecheck、lint、lint:styles、test、build。
- 后端 job：安装固定 Rust toolchain，启动 PostgreSQL 16 服务，运行 fmt、check、clippy、test、migration smoke test、SQLx prepare check，并导出 OpenAPI contract。
- Desktop job：对 `apps/desktop/src-tauri` 运行 `cargo check`，并检查 Tauri 权限配置。
- Contract job：确认 `contracts/openapi.json` 与 `packages/api-client/src/generated.ts` 没有未提交的生成差异，并运行 API client 与 mock handler 的类型检查。
- Container job：如果 CI runner 支持 Docker，运行 `docker build -f Dockerfile.api .`，验证 API Server 可构建为部署镜像。

工具链固定：

- `rust-toolchain.toml` 固定 Rust stable channel 和必要组件，例如 `rustfmt`、`clippy`。
- 根 `package.json` 使用 `packageManager` 声明 Bun 版本。
- GitHub Actions 使用同一 Bun 版本和 Rust toolchain。
- 本地开发文档明确 PostgreSQL 16 为默认数据库版本。
- Rust crate 在各自 `Cargo.toml` 统一使用 2021 edition，后续升级 edition 必须一次性更新 workspace。
- 根 `Cargo.toml` 声明后端 workspace members 为 `crates/*`；`apps/desktop/src-tauri` 作为 Tauri 壳独立运行 `cargo check`，除非后续确认需要纳入同一 Cargo workspace。

Bun workspace 要求：

- 根 `package.json` 声明 `workspaces: ["apps/*", "packages/*"]`。
- 根脚本提供统一入口：`dev`、`build`、`test`、`lint`、`lint:styles`、`typecheck`、`api:types`、`api:check`。
- 根脚本通过 `bun --filter` 或显式 `--cwd` 调用 `apps/web`、`apps/desktop` 与 `packages/api-client`，避免协作者需要记住子目录命令。
- `apps/web` 通过 workspace dependency 引用 `@campus-agora/api-client`，不通过相对路径穿透包边界。
- `apps/web/package.json` 只保留应用局部脚本和依赖；`apps/desktop/package.json` 只保留 Tauri 壳脚本；`packages/api-client/package.json` 只保留客户端局部脚本和依赖；跨项目质量门禁从根目录执行。

本地协作文件：

- `.editorconfig`：统一换行、缩进和末尾换行。
- `.gitignore`：忽略构建产物、依赖目录、环境文件、覆盖率输出、临时目录、数据库 dump 和日志文件，但不忽略 `.sqlx/`。
- `.gitattributes`：声明 Git LFS 跟踪范围，只跟踪确实不适合进入普通 Git 历史的大型二进制资源。
- `CONTRIBUTING.md`：说明分支、提交、测试和 PR 前检查。
- `AGENTS.md`：说明后续 agent 或协作者在本仓库里的工作规范。
- `docs/ai-log/todo.md`：记录 agent 或协作者接下来要做的任务、来源、优先级、依赖和验收条件。
- `docs/ai-log/done.md`：记录已经完成的工作、提交、验证命令、关键决策和后续影响。
- `docs/lfs.md`：说明 Git LFS 的启用、检查和禁止滥用规则。
- `docs/api-contracts.md`：说明前后端接口 contract、路径、参数、分页、错误码、认证、mock 联调、版本和废弃策略。
- `docs/auth-permissions.md`：说明认证 provider、角色、权限策略、匿名语义和审计要求。
- `docs/backend.md`：说明 Rust API Server 分层、domain/application/db/api crate 边界、DTO/domain/application/db model 边界、错误格式、配置、观测、安全和测试规范。
- `docs/architecture.md`：说明 monorepo 边界、依赖方向、前端 app/features/components 组织和 Rust crate 职责。
- `docs/desktop.md`：说明 Tauri WebView、command bridge、权限配置和桌面端开发命令。
- `docs/development.md`：说明前端 app/features/components 组织、API client 使用、mock 模式、组件系统、视觉 token、图标规范、Style Guide 页面、UI 文案约定、开发命令和质量门禁。
- `docs/deployment.md`：说明 API Server Docker 构建、migration、健康检查、staging/production 发布顺序和回滚原则。
- `docs/milestones.md`：说明项目推进阶段、交付物和退出条件。
- `docs/operations.md`：说明环境隔离、备份恢复、监控指标、告警入口、runbook 和线上数据修复流程。
- `docs/security.md`：说明 secret 管理、限流滥用防护、文件上传/下载安全、Tauri 权限、数据保护和安全审计边界。

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
- Rust application/use case 测试验证业务流程编排，例如资料草稿创建、发布前校验、版本更新和审核状态流转。
- Rust repository 测试在 PostgreSQL 上验证关键查询、事务、唯一约束、外键约束和可见性条件。
- Rust API integration 测试验证真实 HTTP 接口，包括 `/healthz`、`/readyz`、`/api/v1/meta`、统一错误格式和 `X-Request-Id`。
- Rust auth/permission 测试验证未登录返回 `401`、越权访问返回 `403` 或不可见资源返回 `404`、状态冲突返回 `409`。
- Rust contract 测试验证 OpenAPI 导出包含初始化接口和响应 schema。
- Rust config 测试验证缺失必需环境变量会得到明确错误，测试环境不会读取生产 secret。
- 配置样例检查验证 `.env.example` 包含 local/dev/staging/production 需要的关键变量名，且不包含真实 secret。
- 前端组件测试验证 `AppShell`、`Topbar`、`Sidebar` 和至少两个 `components/ui` primitive 能渲染核心状态。
- 前端 Style Guide 页面测试验证 `/design-system` 能渲染颜色、字体、按钮、输入框、卡片、空状态、加载状态和错误状态展示区。
- 前端状态组件测试验证 loading、empty、error、unauthorized、forbidden 和 offline 状态至少有统一组件或展示样例。
- 前端 lint 测试或 Stylelint 配置验证页面样式不能使用裸颜色、散乱 px 值和重复基础控件样式。
- `packages/api-client` 测试验证成功响应、失败响应、401、403、404、409、422、429、网络失败、错误归一化、认证策略和 requestId 透传。
- 前端 mock 测试或类型检查验证 mock handler 与 `@campus-agora/api-client` 公开类型一致。
- `apps/desktop/src-tauri` 至少通过 `cargo check`，并验证权限配置文件存在。
- Tauri 权限检查验证 M0 不开放 shell command、任意文件系统访问或未记录用途的 capability。
- 前端类型生成检查验证 `packages/api-client` 没有偏离 `contracts/openapi.json`。
- 文档检查验证 `docs/operations.md` 和 `docs/security.md` 存在，并覆盖环境隔离、备份恢复、告警 runbook、secret 管理、限流和上传安全边界。

不在初始化阶段引入端到端浏览器测试。等真实发布、搜索和审核流程出现后再加入 Playwright。

## 协作规范

协作默认流程：

1. 新功能先补领域模型或 API 契约测试。
2. 后端变更必须跑 fmt、check、clippy、test；涉及数据库时必须跑 migration smoke test；涉及部署镜像时必须跑 `docker build -f Dockerfile.api .`。
3. 前端变更必须跑 typecheck、lint、lint:styles、test、build。
4. API 变更必须更新 OpenAPI contract、生成前端类型、resource client、mock handler，并说明兼容性影响。
5. 权限相关变更必须更新 `docs/auth-permissions.md`，并补充后端 policy 测试。
6. 数据库结构变更必须新增 migration，不直接改历史 migration。
7. 后端配置、CORS、secret、日志字段、部署流程或健康检查变化必须更新 `docs/backend.md` 或 `docs/deployment.md`。
8. 环境隔离、备份恢复、监控告警、runbook、线上数据修复或发布回滚变化必须更新 `docs/operations.md`。
9. 限流、上传下载、对象存储、Tauri 权限、secret 管理或安全审计变化必须更新 `docs/security.md`。
10. 由 agent 推进的非平凡任务必须更新 AI LOG：开始或发现任务时写入 `docs/ai-log/todo.md`，完成后写入 `docs/ai-log/done.md`。
11. 涉及内容治理、隐私、匿名和 AI 输出的变更必须在 PR 描述中说明风险边界。

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

- `M0 Repository Foundation`：完成 monorepo 边界、Bun 前端、`app/features/components` 前端结构、前端视觉系统、基础组件系统、`/design-system` Style Guide 页面、Tauri WebView 壳、TypeScript API client、`domain/application/db/api` Rust crate 分层、OpenAPI contract、API 对接规范、mock 联调边界、统一错误模型、集中配置、tracing/requestId、`/healthz`、`/readyz`、Dockerfile.api、部署文档、operations 文档、security 文档、CI、ESLint、Stylelint、测试、`.gitignore`、`.gitattributes`、AI LOG、LFS 文档、架构文档、后端规范文档、权限文档和协作规范。退出条件是新成员能按 README 跑通前端、桌面壳、后端、测试、样式检查、API contract 生成命令、API client 类型检查、mock 类型检查、`.env.example` 检查和 API Server 镜像构建检查。
- `M1 Identity, Permissions And Shell`：完成认证 provider 抽象、模拟校园认证、用户模型、系统角色、资源角色、应用导航、登录态和基础权限边界。退出条件是前端能基于后端 API 完成登录态展示，后端有认证和权限策略测试。
- `M2 Knowledge Archive Core`：完成资料帖发布、编辑、标签、版本历史、纠错入口和基础列表。退出条件是一篇资料能从创建到更新再到版本追踪完整闭环。
- `M3 Discussion To Archive Loop`：完成讨论帖、评论、精华回复和从讨论沉淀到资料的工作流。退出条件是高质量评论能被引用或整理进资料帖。
- `M4 Moderation And AI Drafting`：完成基础审核后台、风险状态、AI 归档草稿和摘要生成占位接口。退出条件是 AI 结果必须可追溯、可编辑、可审核。
- `M5 Search And Demo Readiness`：完成全文搜索、收藏、引用、贡献展示和比赛演示脚本。退出条件是核心答辩路径可稳定演示，并通过完整 CI。
- `M6 Real Campus Identity Integration`：在拿到学校侧 CAS/OAuth/OIDC 接入条件后，完成真实校园认证 provider、回调配置、测试账号验证和隐私合规检查。退出条件是真实用户可通过校园身份登录，且业务权限无需重写。
- `M7 Production Operations And Security`：完成生产前运维和安全加固，包括环境隔离、备份恢复演练、监控指标、告警 runbook、限流、对象存储上传下载安全、Tauri 自动更新签名策略、发布回滚流程和安全审计清单。退出条件是 staging 可按发布流程完成部署、迁移、健康检查、回滚演练和备份恢复演练，且高风险接口具备限流和审计记录。

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
