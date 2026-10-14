# 外部发现管道技术试验

Last updated: 2026-10-14

P2 技术试验，对应[任务设计 v0.3](../../docs/product/advisor-task-design.md) 第6节和[需求分析 8.2](../../docs/product/requirements-handoff.md)“实际发现”。目的是测量一次真实的搜索 → 正文读取 → 相关性判断与提取 → 与已有资料合并能达到什么质量，不是产品代码。

## 服务选择（2026-10-14）

| 环节 | 服务 | 计费 |
| --- | --- | --- |
| 国内搜索 | 百度千帆 `web_search` | 免费额度内不收费；未开通后付费时额度用完即失败 |
| 海外搜索 | Tavily（basic） | 每月 1000 credits 免费，不绑卡 |
| 正文读取 | Jina Reader | 非商业用途；可免 key 低速调用 |
| 判断与提取 | 智谱 GLM-4.7-Flash（OpenAI 兼容接口） | 免费档，并发 1 |

模型可通过 `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` 换成其他 OpenAI 兼容服务，代码不变。

## 运行

需要 Node 22.18 及以上（直接运行 TypeScript，无第三方依赖）。

```bash
cp .env.example .env   # 在本地填写 key，.env 已被忽略
npm run check          # 四个服务各做一次最小调用
npm run discover -- "我对程序正确性分析感兴趣，想找本科可以参与的科研导师"
npm test               # 离线测试，不需要 key
```

### 给 Web 原型用的本地 API

```bash
npm run serve            # 读取 .env；缺 key 时 /config 报告缺什么，拒绝开始补查
npm run serve:synthetic  # 合成数据模式：不调用任何外部服务，用于检查界面流程
```

只监听 `127.0.0.1:8787`，Web 开发服务器把 `/api/discovery` 代理到这里。同时只允许一次补查（GLM 免费档并发为 1）；中止后迟到的结果不会写入。日志不记录用户问题或 key；运行记录写入 `out/runs/`（已忽略，含用户问题，只在本机）。

| 接口 | 说明 |
| --- | --- |
| `GET /api/discovery/config` | 模式、是否可用、缺少的环境变量、会接收内容的服务、单次上限 |
| `POST /api/discovery/runs` | `{ "question": "…" }`，返回运行快照（202）；进行中再提交返回 409，未配置返回 503 |
| `GET /api/discovery/runs/:id` | 当前快照：步骤状态、整理结果、失败项 |
| `POST /api/discovery/runs/:id/cancel` | 中止，返回快照 |

合成模式的每个响应都带 `mode: "synthetic"`，前端会显示“合成数据模式”提示，不能当作真实发现。

`discover` 可加 `--query "检索词"`（可多次）覆盖默认检索词，`--no-baidu` / `--no-tavily` 关闭某个搜索。按一次 Ctrl+C 停止发起新调用并保留已取得结果。完整记录写入 `out/runs/<runId>.json`（已忽略）。

## 已落实的行为

- **单次上限**：搜索、读取、模型调用次数和总时长均有上限（`src/config.ts` 的 `DEFAULT_LIMITS`），达到后停止新调用，保留部分结果，状态记为 `limit-reached`。
- **中止**：中止后迟到的返回不再写入，状态记为 `cancelled`。
- **失败继续**：单个来源搜索、读取或提取失败会记录下来，其余来源继续。
- **原文核对**：模型给出的每条引文都会与实际发送的正文逐字比对（忽略空白），对不上的标为 `quoteVerified: false`。
- **缓存区分**：请求 Jina 不使用缓存；如仍返回缓存快照，标为 `provider-cache`，不当作本次读取。
- **合并**：已有对象只在姓名和单位（或主页）都对上时才复用；同名但单位不一致或缺失的标为待核，不自动合并；同一来源重复读取不新增候选或依据。

## 数据边界

只向搜索服务和模型发送用户问题和公开网页正文，不涉及探索主题或私人理由。`data/specimens.json` 是 9月29日试采的固定样本，只用于合并检查，不是本次发现的结果。

## 尚未完成

- 用真实 key 跑通连通性检查，并用 2–3 个真实问题比较质量、耗时和失败率
- 由模型扩展检索词（目前直接使用用户问题或 `--query`）
- 跨运行缓存，以及误合并的拆分修正（需要先有持久化方案）
- 根据实测调整上限阈值
