# 后端参考

本文保存后端架构约束。已经接受的正式规则位于 `docs/architecture/backend.md`。

后端是 **Rust Server API**，不是 Tauri 本地 Rust 后端。维护时应按网络 API 服务处理，明确持久化、安全和部署边界。

系统模型是：

```text
前端 Web / Tauri Client
        ↓ HTTP / WebSocket / gRPC
Rust Server Backend
        ↓
PostgreSQL / Redis / Object Storage / External APIs
```

重点维护对象：

```text
API 契约
认证鉴权
数据库模型
业务服务层
日志监控
部署发布
安全边界
性能与并发
```

---

# 1. 推荐后端分层

服务器后端不要直接把所有逻辑写在 route 里。

推荐结构：

```text
Route / Handler 层
        ↓
Service 层
        ↓
Repository 层
        ↓
Database / Cache / External Services
```

职责分别是：

| 层                     | 负责什么                 | 不应该做什么        |
| --------------------- | -------------------- | ------------- |
| **Routes / Handlers** | 接 HTTP 请求、解析参数、返回响应  | 不写复杂业务逻辑      |
| **Services**          | 核心业务逻辑、规则、流程编排       | 不直接拼 SQL      |
| **Repositories**      | 数据库读写                | 不处理 UI/API 细节 |
| **Domain**            | 核心实体、枚举、业务类型         | 不依赖 Web 框架    |
| **Infra**             | Redis、邮件、对象存储、外部 API | 不承载业务规则       |

---

# 2. 推荐目录结构

Rust API Server 可以这样组织：

```text
backend/
├── Cargo.toml
├── migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_projects.sql
│   └── 003_create_sessions.sql
├── src/
│   ├── main.rs
│   ├── app.rs
│   ├── config.rs
│   ├── error.rs
│   ├── routes/
│   │   ├── mod.rs
│   │   ├── auth_routes.rs
│   │   ├── user_routes.rs
│   │   └── project_routes.rs
│   ├── handlers/
│   │   ├── mod.rs
│   │   ├── auth_handler.rs
│   │   └── project_handler.rs
│   ├── services/
│   │   ├── mod.rs
│   │   ├── auth_service.rs
│   │   ├── user_service.rs
│   │   └── project_service.rs
│   ├── repositories/
│   │   ├── mod.rs
│   │   ├── user_repository.rs
│   │   └── project_repository.rs
│   ├── domain/
│   │   ├── mod.rs
│   │   ├── user.rs
│   │   ├── project.rs
│   │   └── session.rs
│   ├── dto/
│   │   ├── mod.rs
│   │   ├── auth_dto.rs
│   │   └── project_dto.rs
│   ├── infra/
│   │   ├── mod.rs
│   │   ├── db.rs
│   │   ├── redis.rs
│   │   ├── mailer.rs
│   │   └── storage.rs
│   └── middleware/
│       ├── mod.rs
│       ├── auth_middleware.rs
│       └── request_id.rs
└── tests/
    ├── auth_test.rs
    └── project_test.rs
```

小项目可以简化，但建议至少保留：

```text
routes / handlers
services
repositories
domain
dto
error
config
migrations
```

---

# 3. Framework 怎么选

Rust 服务器后端常见选择：

| 框架            | 特点               | 适合                  |
| ------------- | ---------------- | ------------------- |
| **Axum**      | 现代、Tokio 生态、类型清晰 | 大多数 API Server，推荐优先 |
| **Actix Web** | 成熟、高性能、生态多       | 高性能 Web 服务          |
| **Rocket**    | 写法友好，抽象较高        | 小中型项目、快速开发          |
| **tonic**     | gRPC 框架          | 微服务、内部服务通信          |

一般 Web/API 后端我会优先建议：

```text
Axum + Tokio + SQLx + PostgreSQL + Redis + tracing
```

这一套比较适合现代 Rust 服务端。

---

# 4. API 层要保持薄

Handler 不要写复杂业务，只做输入输出。

例如：

```rust
pub async fn create_project(
    State(state): State<AppState>,
    Json(req): Json<CreateProjectRequest>,
) -> Result<Json<ProjectResponse>, AppError> {
    let project = state
        .project_service
        .create_project(req)
        .await?;

    Ok(Json(ProjectResponse::from(project)))
}
```

真正业务放到 service：

```rust
impl ProjectService {
    pub async fn create_project(
        &self,
        req: CreateProjectRequest,
    ) -> Result<Project, AppError> {
        if req.name.trim().is_empty() {
            return Err(AppError::BadRequest("项目名称不能为空".into()));
        }

        let project = Project::new(req.name);

        self.project_repository
            .insert(project)
            .await
    }
}
```

这样后期换 API 框架、加 CLI、加后台任务，都不会影响核心业务。

---

# 5. DTO、Domain、DB Model 分开

服务器后端很容易出现一个 struct 到处用的问题。

建议分三类：

```text
DTO：API 请求/响应
Domain Model：业务内部模型
DB Model：数据库行结构
```

例如：

```rust
// dto/project_dto.rs
#[derive(serde::Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
}

#[derive(serde::Serialize)]
pub struct ProjectResponse {
    pub id: String,
    pub name: String,
}
```

```rust
// domain/project.rs
pub struct Project {
    pub id: ProjectId,
    pub owner_id: UserId,
    pub name: String,
    pub status: ProjectStatus,
}
```

好处是：

```text
API 结构可以稳定
数据库可以演进
业务模型不被前端字段污染
安全字段不会误返回给前端
```

比如用户密码 hash、token、内部权限字段，绝对不要因为偷懒直接 serialize 整个数据库对象返回。

---

# 6. 统一错误格式

服务端后端必须维护统一错误响应。

不要每个接口返回不同格式：

```json
"failed"
```

```json
{ "error": "bad request" }
```

```json
{ "msg": "not found" }
```

建议统一成：

```json
{
  "code": "PROJECT_NOT_FOUND",
  "message": "项目不存在",
  "request_id": "req_abc123"
}
```

Rust 侧可以有统一错误：

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Database error")]
    Database(#[from] sqlx::Error),

    #[error("Internal server error")]
    Internal,
}
```

关键是：**前端只依赖稳定 code，不依赖随机 message。**

---

# 7. 认证和鉴权要单独设计

服务器后端比本地后端多了一个核心问题：**谁能访问什么。**

至少要区分：

```text
Authentication：用户是谁
Authorization：用户能做什么
```

常见方案：

```text
Session Cookie：适合 Web App，安全性和可控性好
JWT：适合移动端、多端 API，但吊销和续期要设计好
OAuth：适合接第三方登录
API Key：适合开发者 API、机器访问
```

鉴权不要散落在 handler 里，最好集中成：

```text
auth middleware：解析用户身份
permission service：判断权限
repository query：限制数据范围
```

例如：

```text
用户 A 请求 project_id = 123
后端不能只查 project_id
必须查：project_id = 123 AND owner_id = user_a
```

否则很容易出现越权访问。

---

# 8. 数据库维护：Migration 是必须的

服务器后端建议使用 PostgreSQL，早期小项目也可以 SQLite，但生产服务更推荐 PostgreSQL。

数据库维护规则：

```text
所有 schema 变更必须写 migration
migration 文件一旦合并，不要修改历史
新增字段考虑默认值和 nullable
删除字段分阶段做
索引要跟着查询模式设计
外键、唯一约束、事务要认真用
```

例如：

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
```

常见错误是：业务写得差不多了，数据库完全靠手动改。后期部署、回滚、多人协作都会很痛苦。

---

# 9. 配置管理

服务端配置不要写死在代码里。

配置应包括：

```text
server host / port
database url
redis url
jwt secret / session secret
cors allowlist
log level
object storage config
email provider config
external API keys
feature flags
```

来源一般是：

```text
.env
环境变量
部署平台 secrets
配置中心
```

Rust 中可以集中成：

```rust
pub struct AppConfig {
    pub database_url: String,
    pub redis_url: Option<String>,
    pub server_port: u16,
    pub cors_origins: Vec<String>,
    pub log_level: String,
}
```

原则：**配置集中读取，业务代码不要到处读环境变量。**

---

# 10. 日志、Tracing、Metrics

服务器后端必须可观测。

至少要有：

```text
结构化日志
request_id
错误堆栈
请求耗时
数据库耗时
关键业务事件
健康检查
metrics
```

日志建议记录：

```text
request_id
method
path
status_code
latency
user_id
error_code
```

但不要记录：

```text
密码
token
cookie
完整身份证/银行卡
敏感请求体
完整私密文件内容
```

推荐思想是：

```text
出了问题，可以通过 request_id 从前端错误一路追到后端日志。
```

---

# 11. CORS 和安全边界

Web 前端访问服务器后端时，CORS 要明确配置。

不要生产环境这样：

```text
Access-Control-Allow-Origin: *
```

尤其带 cookie/session 时更危险。

安全上至少维护：

```text
CORS allowlist
CSRF 防护
SQL 注入防护
密码 hash
rate limit
请求体大小限制
文件上传限制
权限校验
secret 管理
依赖安全更新
错误信息脱敏
```

密码存储必须是 hash，不是加密，更不是明文。

---

# 12. 后台任务和队列

服务器后端经常需要异步任务：

```text
发邮件
生成报告
处理上传文件
同步第三方数据
定时清理
AI 推理任务
Webhook 重试
```

不要让 HTTP 请求一直等超长任务。

推荐模式：

```text
HTTP 请求创建任务
返回 job_id
后台 worker 执行
前端轮询或 WebSocket 获取进度
```

结构：

```text
API Server
   ↓ enqueue job
Queue / Redis
   ↓
Worker
   ↓
Database 更新任务状态
```

小项目可以先用 Tokio background task；项目变复杂后，再引入 Redis queue、消息队列或独立 worker。

---

# 13. API 契约要维护

前端和后端之间要有稳定契约。

建议维护：

```text
接口路径
请求参数
响应结构
错误 code
认证方式
分页格式
排序/filter 规则
版本兼容策略
```

例如列表接口统一：

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 135
}
```

不要这个接口叫 `data`，那个接口叫 `list`，另一个叫 `rows`。

分页也要统一：

```text
小中型后台：page + page_size
大数据列表：cursor pagination
```

---

# 14. 测试策略

服务器后端建议至少有：

```text
Unit Test：测纯业务函数
Service Test：测业务流程
Repository Test：测数据库读写
API Integration Test：测真实 HTTP 接口
Auth Test：测登录、权限、越权访问
Migration Test：测数据库迁移
```

最重要的是 API integration test，因为它能保证前端真正能调通。

例如测试：

```text
未登录访问项目列表 -> 401
用户 A 访问用户 B 的项目 -> 403 或 404
创建项目缺少 name -> 400
创建成功 -> 201
重复名称 -> 409
```

---

# 15. 部署和 CI/CD

服务端后端要维护发布流程，不只是本地能跑。

最低配置：

```text
cargo fmt
cargo clippy
cargo test
docker build
migration check
deploy
health check
rollback
```

典型流程：

```text
push code
   ↓
CI 跑格式、lint、测试
   ↓
构建 Docker image
   ↓
部署到 staging
   ↓
执行 migration
   ↓
健康检查
   ↓
部署 production
```

后端服务需要健康检查接口：

```text
GET /health
GET /ready
```

区别是：

```text
/health：服务进程活着
/ready：数据库、Redis 等依赖也可用
```

---

# 16. 前后端项目边界

整体项目可以这样拆：

```text
apps/
├── web-client/
│   └── TypeScript 前端
├── desktop-client/
│   └── Tauri 客户端，可选
└── server/
    └── Rust 后端
```

或者：

```text
frontend/
backend/
shared/
```

其中 `shared` 可以放：

```text
API 类型
OpenAPI schema
错误码定义
通用常量
```

但注意：Rust 和 TypeScript 不要强行共享太多业务逻辑。真正要共享的是 **契约**，不是所有实现。

---

# 17. 建议的服务器后端技术组合

比较稳的组合是：

```text
Rust Web Framework：Axum
Async Runtime：Tokio
Database：PostgreSQL
DB Client：SQLx
Cache / Session：Redis
Error：thiserror + 自定义 AppError
Serialization：serde
Logging / Tracing：tracing
Config：环境变量 + config struct
Deployment：Docker
API Contract：OpenAPI 或自动生成 TS 类型
```

对应职责：

```text
Axum：HTTP API
Tokio：异步运行时
SQLx：数据库查询
PostgreSQL：主数据存储
Redis：缓存、限流、session、队列
tracing：日志与链路追踪
Docker：部署一致性
```

---

# 最终维护重点

服务器 Rust 后端最重要的不是“写很多 Rust 代码”，而是维护这 10 件事：

```text
1. API 契约稳定
2. 业务逻辑集中在 service
3. 数据访问集中在 repository
4. 认证鉴权清晰
5. 错误格式统一
6. 数据库 migration 可靠
7. 配置和 secret 不写死
8. 日志、metrics、request_id 完整
9. 测试覆盖关键业务和权限
10. 部署、回滚、健康检查流程明确
```

总结：

**服务器后端要当成一个长期运行、多人调用、可观测、可升级的系统来维护，而不是单纯给前端提供几个接口的脚本。**
