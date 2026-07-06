# Monorepo 参考

本文保存仓库结构和质量门禁约束。已经接受的正式规则位于根工作区配置、`scripts/` 和 `docs/engineering/*`。

仓库需要可执行的约定，而不是为了形式感堆框架。关键边界是 **统一技术栈、统一目录结构、统一代码分层、统一接口调用方式、统一质量检查**。

约束分为三类：

```text
1. 技术框架要求：用什么框架/库
2. 代码结构要求：代码怎么分层、怎么放
3. 工程规范要求：格式化、类型检查、测试、CI 怎么跑
```

---

# 1. 前端框架要求

如果客户端包含 Web / Tauri，建议前端明确这些：

```text
语言：TypeScript
构建工具：Vite
UI 框架：React / Vue / Svelte 选一个
样式方案：Tailwind / CSS Modules / UnoCSS / CSS Variables 选一个
状态管理：Zustand / Pinia / Redux Toolkit 选一个
请求管理：TanStack Query 或自封装 api client
表单：React Hook Form / vee-validate 等
校验：Zod / Valibot
图标：Lucide / Material Symbols / Fluent Icons 选一个
```

如果需要默认方案时，我会选：

```text
React + TypeScript + Vite
Tailwind + CSS Variables
TanStack Query
Zod
Lucide Icons
```

Tauri 客户端也可以继续用这套，只是外面多一层 Tauri 壳。

---

# 2. 前端目录结构要求

前端不要所有东西塞 `components`。

推荐结构：

```text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx
├── api/
│   ├── client.ts
│   ├── auth.ts
│   ├── projects.ts
│   └── types.ts
├── components/
│   ├── ui/
│   ├── layout/
│   └── icons/
├── features/
│   ├── auth/
│   ├── projects/
│   └── settings/
├── styles/
│   ├── tokens.css
│   ├── globals.css
│   └── theme.css
├── hooks/
├── lib/
└── utils/
```

核心规则：

```text
components/ui：通用基础组件
features：业务模块
api：所有后端接口调用
styles：全局风格和 design tokens
pages/routes：只负责页面组合
```

页面里不要直接乱写 `fetch`，统一走 `api/`。

---

# 3. 前端 API 调用要求

前端必须有统一 API client。

不推荐：

```ts
const res = await fetch("/api/projects");
const data = await res.json();
```

推荐：

```ts
// api/client.ts
export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw error;
  }

  return res.json();
}
```

然后业务接口这样写：

```ts
// api/projects.ts
export function listProjects() {
  return request<ProjectListResponse>("/api/v1/projects");
}

export function createProject(input: CreateProjectInput) {
  return request<Project>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

页面只调用：

```ts
const { data } = useQuery({
  queryKey: ["projects"],
  queryFn: listProjects,
});
```

这样接口变了，只改 `api/`，不要全项目到处找。

---

# 4. 后端框架要求

如果服务器后端是 Rust，建议明确这套：

```text
Web 框架：Axum
异步运行时：Tokio
数据库：PostgreSQL
数据库访问：SQLx
缓存/队列：Redis，可选
序列化：serde
错误处理：thiserror
日志追踪：tracing
配置：config struct + env
API 文档：OpenAPI
测试：cargo test + integration tests
部署：Docker
```

推荐组合：

```text
Axum + Tokio + SQLx + PostgreSQL + Redis + tracing + OpenAPI
```

---

# 5. 后端目录结构要求

Rust 后端建议这样：

```text
backend/
├── migrations/
├── src/
│   ├── main.rs
│   ├── app.rs
│   ├── config.rs
│   ├── error.rs
│   ├── routes/
│   ├── handlers/
│   ├── services/
│   ├── repositories/
│   ├── domain/
│   ├── dto/
│   ├── infra/
│   └── middleware/
└── tests/
```

职责要写清楚：

```text
routes：注册路由
handlers：接收请求、返回响应
services：业务逻辑
repositories：数据库读写
domain：业务实体
dto：请求/响应结构
infra：数据库、Redis、邮件、对象存储等外部依赖
middleware：认证、日志、request id、CORS
```

后端最重要的代码要求是：

```text
handler 要薄
service 写业务
repository 写数据访问
domain 不依赖 Axum
DTO 不直接等于数据库表
```

---

# 6. 前后端类型同步要求

这个很关键。

需要规定：**前端 TS 类型不能靠手抄乱维护。**

推荐两种方式：

## 方案 A：OpenAPI 生成 TypeScript 类型

后端维护 OpenAPI schema，前端自动生成类型和 client。

```text
Rust DTO
   ↓
OpenAPI schema
   ↓
TypeScript types / API client
```

适合团队协作。

## 方案 B：Rust DTO 直接导出 TS 类型

用工具从 Rust struct 生成 TS 类型。

适合 Rust + TS 项目。

无论哪种，都要避免：

```text
后端字段叫 project_id
前端以为叫 projectId
后端返回 number
前端以为是 string
后端删字段
前端运行时才发现 undefined
```

---

# 7. 接口规范要求

建议统一规定：

```text
API 版本：/api/v1
数据格式：JSON
字段命名：camelCase
时间格式：ISO 8601
ID 格式：string
错误格式：code/message/requestId
分页格式：items/page/pageSize/total
认证方式：Bearer Token 或 Session Cookie
```

例如错误统一：

```json
{
  "code": "PROJECT_NOT_FOUND",
  "message": "项目不存在",
  "requestId": "req_abc123"
}
```

列表统一：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 135
}
```

---

# 8. 代码质量要求

这个也要明确，否则项目会越写越散。

前端建议：

```text
TypeScript strict: true
ESLint
Prettier
lint-staged
组件命名规范
禁止页面直接 fetch
禁止随意写颜色/间距散值
禁止 any 泛滥
```

后端建议：

```text
cargo fmt
cargo clippy
cargo test
SQL migration check
统一 AppError
统一 tracing log
禁止 unwrap/expect 滥用
禁止把 secret 写进代码
```

CI 至少跑：

```bash
# frontend
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# backend
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cargo build
```

---

# 9. Monorepo 结构建议

如果同时维护 Web、Tauri、Rust Server，可以这样放：

```text
project/
├── apps/
│   ├── web-client/
│   └── desktop-client/
├── backend/
│   └── server/
├── packages/
│   ├── api-client/
│   ├── ui/
│   └── config/
├── docs/
│   ├── api.md
│   └── architecture.md
└── docker/
```

或者简单一点：

```text
project/
├── frontend/
├── desktop/
├── backend/
└── docs/
```

早期项目不要过度 monorepo 化，先保证边界清晰。

---

# 10. 默认框架要求

长期维护产品可采用以下默认组合：

```text
前端：
React + TypeScript + Vite
Tailwind + CSS Variables
TanStack Query
Zod
Lucide Icons

桌面端：
Tauri
只负责桌面壳、本地能力、自动更新、本地缓存

后端：
Rust + Axum + Tokio
PostgreSQL + SQLx
Redis 可选
thiserror + tracing
OpenAPI

接口：
REST API
/api/v1
camelCase JSON
统一错误格式
统一分页格式
OpenAPI 生成 TS 类型

工程：
pnpm
cargo fmt / clippy / test
ESLint / Prettier / TypeScript strict
Docker
CI 自动检查
```

---

# 最终结论

**要有代码框架要求，但要分层规定，不要只规定“用什么框架”。**

需要真正定下的是：

```text
1. 前端用什么技术栈
2. 后端用什么技术栈
3. 目录怎么组织
4. API 怎么调用
5. 类型怎么同步
6. 错误怎么处理
7. 测试怎么跑
8. 代码提交前必须过哪些检查
```

总结：

**框架要求不是为了限制开发，而是为了让项目长期不乱。**
