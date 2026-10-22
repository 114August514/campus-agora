# 文件树与过程文件归属

Last updated: 2026-10-22

本页说明现有仓库的目录职责与文件放置规则。代码目录依据当前工作区配置保留；目录存在不代表对应产品能力属于当前范围。产品范围与顺序仍以[产品概览](../product/overview.md)和[里程碑](../product/milestones.md)为准。

## 项目文件树

```text
campus-lumen/
├── apps/
│   ├── web/                  React Web 应用、测试、已核对的演示数据
│   └── desktop/              现有 Tauri 桌面壳，不产生新开发任务
├── crates/
│   ├── api/                  HTTP API、发现与读取入口、接口导出
│   ├── application/          应用业务逻辑
│   ├── domain/               领域类型与规则
│   └── db/                   数据库访问与迁移
├── packages/api-client/      共享 TypeScript API 客户端与生成类型
├── contracts/               生成并纳入版本管理的 OpenAPI 契约
├── docs/
│   ├── product/             需求基线、产品决定、任务设计、UI 与隐私规则
│   ├── architecture/        架构与接口说明
│   ├── engineering/         开发、目录规则、质量门禁
│   ├── constraints/         可复用参考、研究证据与详细约束
│   ├── operations/          部署与安全说明
│   ├── ai-log/              简短待办和已完成事实
│   └── superpowers/         历史规格和计划，已排除于文档站
├── tools/
│   ├── docs/                MkDocs 与 uv 配置
│   ├── discovery/           可复用的采集批次校验工具
│   ├── skills/              仓库内可显式调用的研究 skill
│   └── prototypes/          保留供查阅的已整理文本样稿及说明
├── scripts/                 可复用开发、构建与 CI 脚本
├── docker/                  容器配置
├── .github/                 CI 工作流
├── .worktrees/              本地附加 Git 工作区，保留各分支未提交改动
├── work/                    本地中间过程区，仅 README 参与版本管理
├── README.md                项目入口
├── AGENTS.md                Agent 协作规则
└── 工作区配置与锁文件        Bun、Cargo、格式检查等工具的固定入口
```

`node_modules/`、`target/`、`site/`、各应用的 `dist/` 和虚拟环境属于依赖、缓存或生成产物，按工具约定留在原位并由 Git 忽略。工具维护的本地隐藏目录不作为过程记录入口。根配置、锁文件及源码路径保持原位，避免破坏自动发现、导入和 CI。

## 中间过程集中到哪里

每项需要文件的临时工作使用 `work/YYYY-MM-DD-task/`。按实际需要放入 `notes.md`、草稿、临时脚本、截图及实验输出，无需预建整套子目录或为小任务另写计划。

| 文件内容 | 归属与处理 |
| --- | --- |
| 尚未确定的想法、检索摘录、调试输出、临时验证脚本 | `work/` 中对应任务目录，默认不提交、不发布 |
| 需要跨会话保留的待办、结果、验证结论 | `docs/ai-log/todo.md` / `done.md`，只写简短摘要与必要定位 |
| 已接受的需求、接口、规则与架构决定 | 对应正式文档，不能只留在本地过程区 |
| 可复用且需要审查的研究证据与约束 | `docs/constraints/`，按现有索引组织 |
| 稳定的工具、skill 和自动化 | `tools/` 或 `scripts/`，保留用途与调用说明 |
| 已核对且被应用使用的资料批次、测试夹具 | 对应应用的数据或测试目录，保持来源、时间和适用范围 |

`work/` 的忽略规则仅保留 `work/README.md`，不以 `git add -f` 提交过程内容。源码、测试、构建和正式文档不能依赖仅存于 `work/` 的文件。需要协作或复现的成果先整理到上表中的长期位置，再正常审查；本地过程区不会随克隆或交接同步。

任务结束时提炼必要结论，其他过程材料可继续本地保留或在确认后清理，不自动删除。忽略 Git 不等于允许保存密钥、凭据、认证画面或私人学生资料，仍遵守现有隐私与记录规则。

## 本次整理

- `temp/temp1.md` → `work/legacy/notes/temp1.md`：原有选题调研草稿，保留原文，不作为现行需求。
- `tools/prototypes/opportunities.html` → `work/legacy/prototype/opportunities.html`：未纳入版本管理的旧 HTML，保留原文，仅供历史交互参考，不作为 Primer UI 模板。
- `tools/prototypes/opportunity-content.md` 保持原位：它是已整理、被需求资料引用的文本证据，不因年代较早就移入临时区。
- 既有 AI 日志和历史规格保持原位，保留引用及时间上下文；新过程内容按上述规则归位，不复制聊天全文进正式文档。

旧的 `tmp/`、`temp/` 忽略规则继续兼容工具输出，新的人工作业过程统一使用 `work/`。

## 项目更名与兼容标识

2026-10-22项目名改为Campus Lumen，仓库改为`114August514/campus-lumen`。本机实际检出目录为`/home/august/Projects/campus-lumen`，`origin`使用`git@github.com:114August514/campus-lumen.git`。

旧路径`/home/august/Projects/campus-agora`保留为指向新目录的兼容符号链接，不是另一份检出。当前聊天、已保存项目入口和本地环境仍可能引用旧路径；在这些入口改为新路径之前保留该链接。以后新建终端或选择项目目录时使用`campus-lumen`。

本次更新对外项目名、项目介绍、仓库元数据、Web／桌面窗口名、API显示名称及文档站。内部`@campus-agora/*`包名、`campus_agora_*`crate／数据库标识、桌面应用identifier，以及`campus-agora:explorations:v1`浏览器保存键保持兼容，避免引入无关迁移或使已存主题不可见。历史规格、原始研究和旧日志保留其当时名称；它们不作为对外项目名的事实来源。

## 附加工作区集中存放

2026-10-22将两个旧的兄弟目录移入本仓库的`.worktrees/`，使用`git worktree move`保留完整工作区，并修复Git注册路径：

| 原目录 | 当前目录 | 分支 |
| --- | --- | --- |
| `campus-agora-advisor-prototype` | `.worktrees/advisor-prototype/` | `prototype/advisor-guide` |
| `campus-agora-explore-focus` | `.worktrees/explore-focus/` | `feat/explore-focus` |

两个工作区均有独立未提交内容，不能作为重复副本直接删除，也没有合并到当前实现或产生新开发任务。它们与主目录共享Git仓库，但保留各自的文件、分支和暂存状态。后续评估是否复用或归档时，先检查改动和引用，再按需处理；不删除分支，不用清理命令丢弃未提交文件。

`.worktrees/`已由Git忽略，属于本地代码工作区；`work/`用于笔记、草稿与实验输出。现有`.claude/worktrees/`由原工具维护，本次只修正其Git注册中的旧根路径。主目录及这三个附加工作区的注册现在都指向`campus-lumen`下的实际路径；旧根兼容链接仍服务当前聊天和已保存项目入口。
