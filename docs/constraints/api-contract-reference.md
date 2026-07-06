# API 契约参考

本文保存前后端对接的详细约束。已经接受的正式规则位于 `docs/architecture/api-contracts.md`。

前后端对接必须以契约为先。预期拓扑是：

```text
TypeScript 前端 / Tauri 客户端
        ↓ HTTP / WebSocket
Rust 服务器后端
        ↓
Database / Redis / Storage
```

如果缺少共享契约，项目后期容易积累这些问题：

```text
接口字段名不一致
错误格式不一致
分页格式不一致
前端类型和后端返回对不上
登录态处理混乱
接口改动导致前端突然坏掉
不知道哪些接口能用、哪些废弃
```

API 契约的核心目标是：

**前端知道如何调用，后端知道如何返回，双方通过经过审查的契约安全演进。**

---

## 1. API 路径规范

接口路径要统一风格。

推荐 REST 风格：

```text
GET    /api/projects              获取项目列表
POST   /api/projects              创建项目
GET    /api/projects/:project_id  获取项目详情
PATCH  /api/projects/:project_id  更新项目
DELETE /api/projects/:project_id  删除项目
```

不要混成这样：

```text
/getProject
/project/create
/api/delete_project
/project/listAll
```

建议规则：

```text
资源用名词复数：/projects /users /files
动作用 HTTP method 表达：GET / POST / PATCH / DELETE
路径用 kebab-case 或 snake_case，统一一种
不要在路径里乱塞 get/create/delete
```

---

## 2. 请求参数规范

不同类型参数要放在固定位置。

```text
路径参数：资源 ID
查询参数：筛选、排序、分页
请求体：复杂数据
Header：认证、语言、request id
```

例如：

```http
GET /api/projects?page=1&page_size=20&status=active
```

```json
{
  "name": "My Project",
  "description": "Demo project"
}
```

推荐统一命名风格。前端是 TS，后端是 Rust，API JSON 建议用 **camelCase**：

```json
{
  "projectId": "p_123",
  "createdAt": "2026-07-06T12:00:00Z"
}
```

Rust 侧可以用 serde 转换：

```rust
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectResponse {
    pub project_id: String,
    pub created_at: String,
}
```

这样 Rust 内部用 `snake_case`，API 对外用 `camelCase`。

---

## 3. 响应格式规范

建议统一响应结构，尤其是列表接口和错误接口。

详情接口可以直接返回对象：

```json
{
  "projectId": "p_123",
  "name": "Demo",
  "createdAt": "2026-07-06T12:00:00Z"
}
```

列表接口建议统一：

```json
{
  "items": [
    {
      "projectId": "p_123",
      "name": "Demo"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 135
}
```

不要有的接口返回：

```json
{
  "data": []
}
```

另一个接口返回：

```json
{
  "list": [],
  "count": 135
}
```

再另一个返回：

```json
{
  "rows": []
}
```

这会让前端 API 层很难维护。

---

## 4. 错误格式规范

这是最重要的规范之一。

推荐错误统一成：

```json
{
  "code": "PROJECT_NOT_FOUND",
  "message": "项目不存在",
  "requestId": "req_abc123"
}
```

前端不要根据 `message` 判断逻辑，而是根据 `code` 判断。

例如：

```ts
if (error.code === "PROJECT_NOT_FOUND") {
  showToast("项目不存在");
}
```

HTTP 状态码也要统一：

```text
400 Bad Request：参数错误
401 Unauthorized：未登录
403 Forbidden：无权限
404 Not Found：资源不存在
409 Conflict：资源冲突，比如重复创建
422 Unprocessable Entity：业务校验失败
429 Too Many Requests：请求过快
500 Internal Server Error：服务端异常
```

错误 code 可以维护一份表：

```text
AUTH_REQUIRED
PERMISSION_DENIED
PROJECT_NOT_FOUND
PROJECT_NAME_EXISTS
VALIDATION_FAILED
INTERNAL_ERROR
```

---

## 5. 认证规范

前后端必须提前定好登录态怎么传。

常见两种：

### 方案 A：Session Cookie

适合 Web App。

```text
浏览器自动带 cookie
后端用 session 判断用户
安全性较好
需要处理 CSRF
```

### 方案 B：Bearer Token / JWT

适合 Tauri、移动端、开放 API。

```http
Authorization: Bearer <token>
```

适合 Tauri 客户端场景。

但要规范好：

```text
access token 有效期
refresh token 怎么续期
token 存在哪里
退出登录怎么清理
401 时前端怎么处理
refresh 失败怎么回登录页
```

---

## 6. 分页、筛选、排序规范

列表接口一定要统一。

例如：

```http
GET /api/projects?page=1&pageSize=20&sort=createdAt:desc&status=active
```

响应：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 135
}
```

如果后期数据量很大，可以换 cursor pagination：

```http
GET /api/events?cursor=xxx&limit=50
```

响应：

```json
{
  "items": [],
  "nextCursor": "yyy",
  "hasMore": true
}
```

关键是：**所有列表接口统一一种分页模型。**

---

## 7. TypeScript 类型要和 Rust DTO 同步

这是前后端对接里最容易出问题的地方。

前端应该有明确类型：

```ts
export type Project = {
  projectId: string;
  name: string;
  createdAt: string;
};
```

后端 Rust DTO：

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectResponse {
    pub project_id: String,
    pub name: String,
    pub created_at: String,
}
```

小项目可以手动维护。

中大型项目建议用以下方式之一：

```text
OpenAPI 生成 TypeScript 类型
Rust DTO 自动导出 TS 类型
共享 schema，比如 JSON Schema / Zod
```

否则接口一改，前端可能运行时才发现炸了。

---

## 8. API Client 要封装

前端不要每个页面直接写 `fetch`。

不推荐：

```ts
// 页面里到处 fetch
const res = await fetch("/api/projects");
```

推荐封装：

```ts
// api/client.ts
export async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw error;
  }

  return res.json();
}
```

业务 API 再封一层：

```ts
// api/projects.ts
export function listProjects() {
  return request<Project[]>("/api/projects");
}

export function createProject(input: CreateProjectInput) {
  return request<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

页面只调用：

```ts
const projects = await listProjects();
```

这样接口变化时，只需要改 API 层，不要全项目乱找。

---

## 9. 版本规范

如果产品会长期维护，API 最好带版本：

```text
/api/v1/projects
/api/v1/users
```

不要一开始就频繁改已上线接口。

改接口时遵守：

```text
新增字段：通常安全
删除字段：危险
改字段名：危险
改字段类型：危险
改错误 code：危险
改分页结构：危险
```

更稳的做法是：

```text
兼容旧字段一段时间
新增 v2 接口
标记 deprecated
前端迁移完成后再删除
```

---

## 10. WebSocket / 实时消息也要规范

如果项目包含实时通知、任务进度、聊天、同步状态，WebSocket 消息也要有统一结构。

例如：

```json
{
  "type": "task.progress",
  "payload": {
    "taskId": "task_123",
    "progress": 42
  }
}
```

不要随便发：

```json
{
  "progress": 42
}
```

建议所有消息都有：

```text
type
payload
requestId / correlationId，可选
timestamp，可选
```

---

## 11. API Contract 维护

可以是以下任意一种：

```text
OpenAPI 文档
接口 Markdown 文档
Postman / Bruno 集合
自动生成的 Swagger UI
Rust DTO + TS 类型生成
```

最少也要记录：

```text
接口路径
请求 method
请求参数
响应结构
错误 code
认证要求
示例请求
示例响应
```

---

## 最推荐的规范组合

按当前方向，建议：

```text
前端：TypeScript
客户端：Web / Tauri
后端：Rust Axum
接口：REST API
认证：Bearer Token 或 Session Cookie，Tauri 更适合 Bearer Token
数据格式：JSON
字段命名：camelCase
错误格式：统一 code/message/requestId
分页格式：items/page/pageSize/total
文档：OpenAPI
前端调用：封装 api client
类型同步：OpenAPI 生成 TS 类型，或 Rust DTO 导出 TS 类型
```

---

## 结论

**前后端对接必须规范化。**

不然前期看起来快，后期一定会在这些地方还债：

```text
接口改动没人知道
前端类型对不上
错误处理混乱
权限边界不清
分页/筛选重复造轮子
联调效率低
线上问题难排查
```

可以把它理解成：

```text
UI 风格靠 Design System 维护
后端代码靠分层架构维护
前后端对接靠 API Contract 维护
```

核心结论：**前后端之间不要靠口头约定，要靠稳定的接口规范和类型契约。**
