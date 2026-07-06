# 运维风险参考

本文保存运维、发布和安全风险约束。已经接受的正式规则位于 `docs/operations/*` 和 `docs/product/privacy.md`。

工程结构必须配套生产结构。下面的风险大致按“越靠前越应尽早影响实现”的顺序排列。

## 最容易漏掉的 12 件事

### 1. 认证与权限模型

前文提到前后端对接，但还要单独设计：

```text
用户是谁：Authentication
用户能做什么：Authorization
用户能访问哪些数据：Resource Permission
```

特别是项目、文件、团队、订单、聊天记录这类资源，不能只靠前端隐藏按钮。后端每个接口都要校验资源归属。OWASP API Security 2023 把 Broken Object Level Authorization 放在 API 风险首位，典型问题就是用户通过改 URL 或参数里的对象 ID 访问不属于自己的资源。([OWASP Foundation][1])

需要提前定：

```text
是否有团队/组织
是否有 owner/admin/member/viewer
是否支持邀请成员
资源属于 user 还是 workspace
删除权限谁有
导出权限谁有
API key 权限怎么限制
```

---

### 2. 数据库备份、恢复、迁移

很多人只考虑“数据库怎么设计”，没考虑“数据坏了怎么办”。

需要有：

```text
自动备份
备份保留周期
恢复演练
migration 规范
回滚策略
线上数据修复流程
```

尤其是 Rust 后端 + PostgreSQL，如果将来上线真实用户数据，备份和恢复比表结构本身更重要。

---

### 3. 环境隔离

至少要有：

```text
local：本地开发
dev：开发环境
staging：预发布
production：生产环境
```

每个环境要有独立的：

```text
数据库
Redis
对象存储 bucket
API domain
密钥
OAuth callback URL
日志等级
支付/邮件配置
```

不要本地、测试、生产共用一套数据库或密钥。

---

### 4. 配置与密钥管理

不要把配置写死在代码里，也不要把 secret 放进 Git。

需要单独管理：

```text
DATABASE_URL
REDIS_URL
JWT_SECRET / SESSION_SECRET
OAuth client secret
S3 access key
邮件服务 key
支付服务 key
第三方 API key
```

12-Factor App 的核心原则之一是把配置存放在环境中，日志也应作为事件流处理，这套思想很适合服务器后端部署。([Twelve-Factor App][2])

---

### 5. 日志、监控、告警

需要知道线上发生了什么。

最低限度要有：

```text
请求日志
错误日志
requestId
用户 ID，可脱敏
接口耗时
数据库耗时
状态码统计
panic 捕获
健康检查
```

最好再加：

```text
metrics
trace
alert
dashboard
```

否则线上用户反馈“用不了”时，团队只能猜测原因。

建议每个错误响应都有：

```json
{
  "code": "INTERNAL_ERROR",
  "message": "服务异常，请稍后再试",
  "requestId": "req_abc123"
}
```

然后日志里也能按 `requestId` 查到完整链路。

---

### 6. API 文档和契约生成

已有共识认为前后端对接要规范化。下一步是不要手写同步，最好有 API contract。

OpenAPI 的定位就是用标准格式描述 HTTP API 的能力、接口表面和语义，方便人和工具理解服务。([Swagger][3])

建议：

```text
后端 Rust DTO
   ↓
OpenAPI schema
   ↓
生成 TypeScript types / API client
   ↓
前端调用
```

这样可以减少“后端字段改了，前端不知道”的问题。

---

### 7. 错误码体系

不要只设计成功响应，也要设计失败响应。

需要维护一份错误码表：

```text
AUTH_REQUIRED
TOKEN_EXPIRED
PERMISSION_DENIED
VALIDATION_FAILED
PROJECT_NOT_FOUND
PROJECT_NAME_EXISTS
RATE_LIMITED
INTERNAL_ERROR
```

前端根据 `code` 做逻辑，不要根据中文 `message` 判断。

---

### 8. 文件上传、对象存储、下载安全

只要产品涉及文件，就要提前设计：

```text
文件大小限制
文件类型限制
病毒/恶意内容扫描，视场景
对象存储路径规范
上传失败重试
下载权限校验
临时签名 URL
文件删除策略
文件版本管理
```

不要让用户上传的文件直接变成公开可访问 URL。

---

### 9. 速率限制和滥用防护

登录、注册、短信、邮件、AI 接口、搜索接口、上传接口都需要限流。

至少要考虑：

```text
IP 限流
用户级限流
API key 限流
登录失败次数限制
验证码策略
高成本接口限流
```

否则被刷接口、刷注册、刷 AI 成本时会很被动。

---

### 10. Tauri 桌面端的安全权限

如果项目还包含 Tauri 客户端，不能只把它当浏览器壳。Tauri v2 有 capabilities/permissions 机制，用来控制哪些窗口或 WebView 被授予哪些权限。([Tauri][4])

需要定清楚：

```text
哪些本地能力允许前端调用
哪些文件路径可以访问
是否允许 shell command
是否允许打开外部链接
token 存在哪里
自动更新怎么校验
本地缓存是否加密
```

前端不要能随便让 Tauri 执行任意系统命令。

---

### 11. CI/CD 和发布策略

需要的不只是“能跑”，还要“能稳定发布”。

建议至少有：

```text
前端 build
后端 cargo test
cargo clippy
类型检查
Docker build
migration check
staging 部署
production 部署
回滚方案
```

发布方式也要定：

```text
Web 前端怎么部署
Rust server 怎么部署
数据库 migration 什么时候跑
失败后怎么回滚
Tauri 客户端怎么自动更新
版本号怎么管理
```

---

### 12. 产品级状态：空、错、加载、离线、权限不足

前端不是只画正常页面。

每个核心页面都要考虑：

```text
loading
empty
error
unauthorized
forbidden
offline
syncing
retrying
partial failed
```

尤其 Tauri 桌面端，要考虑网络断开、服务器不可用、token 过期、本地缓存过期这些状态。

---

## 参考系统图

```text
Client Layer
├── Web Client：浏览器前端
├── Tauri Client：桌面端
└── Shared UI / API Client

API Layer
├── REST API / WebSocket
├── Auth Middleware
├── Rate Limit
├── Request ID
└── Error Response

Backend Layer
├── Handlers
├── Services
├── Repositories
├── Domain Models
└── Background Jobs

Data Layer
├── PostgreSQL
├── Redis
├── Object Storage
└── Search Index，可选

Ops Layer
├── Logs
├── Metrics
├── Tracing
├── Backup
├── CI/CD
└── Alerts
```

---

## 补齐顺序

第一阶段，先做“不会乱”：

```text
1. monorepo 结构
2. 前端风格规范
3. Rust 后端分层
4. API contract
5. 统一错误格式
6. 数据库 migration
```

第二阶段，做“能上线”：

```text
7. 登录认证
8. 权限模型
9. 环境隔离
10. 日志和 requestId
11. CI/CD
12. 基础监控
```

第三阶段，做“能长期运营”：

```text
13. 备份恢复
14. 告警
15. 限流
16. 后台任务
17. 文件存储
18. 发布回滚
19. Tauri 自动更新
20. 安全审计
```

---

## 最容易被低估的 5 个点

```text
1. 权限模型：后期最难补
2. 错误码体系：影响前端体验和排查
3. 数据库 migration：影响上线和回滚
4. 日志/requestId：影响线上排障
5. API 类型同步：影响前后端协作效率
```

当前思路已经覆盖了“怎么开发”。接下来要补的是：**怎么上线、怎么排查、怎么扩展、怎么保护数据、怎么避免多人协作后变乱。**

[1]: https://owasp.org/API-Security/editions/2023/en/0x11-t10/ "OWASP Top 10 API Security Risks – 2023"
[2]: https://12factor.net/ "The Twelve-Factor App"
[3]: https://swagger.io/specification/ "OpenAPI Specification - Version 3.1.0"
[4]: https://v2.tauri.app/security/capabilities/ "Capabilities"
