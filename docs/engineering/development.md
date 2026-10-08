# Development

Last updated: 2026-10-08

## Requirements

- Bun `1.3.14`
- Rust stable with `rustfmt` and `clippy`
- PostgreSQL 16 for migration smoke tests
- uv for MkDocs

## Local API

```bash
cp .env.example .env
cargo run -p campus_agora_api
```

The API exposes:

- `GET /healthz`
- `GET /readyz`
- `GET /api/v1/meta`
- `POST /api/v1/discoveries`

`/readyz` checks PostgreSQL when `DATABASE_URL` is configured.

## Local Advisor Demo

Run `bun run dev:api` and `bun run dev:web` in separate terminals, then open
`http://127.0.0.1:5173`. Vite proxies `/api` to the API on port 8080. This
slice needs no database, external API key or paid model service. Keep the API
local while testing; the current two-request concurrency limit is not public
service rate limiting.

Try the public query `机器学习`. The API first attempts DuckDuckGo search and
actual academic HTML reading. If the index is unavailable, it reads and matches
the explicitly named Stanford AI and CMU ML directories. The page shows that
limited scope and any failures; an empty match is not proof that no advisors
exist. Search text is sent to DuckDuckGo; private topic notes are not. See
[privacy](../product/privacy.md) for the exact boundary.

Create a topic only when saving is useful. Save a reviewed sample, or associate
a fetched page with a candidate identified from its contents. In “我的探索”, edit
private reasons/questions; close and reopen the same origin in the same browser
to restore them. Storage uses `campus-agora:explorations:v1` in localStorage,
without accounts, cross-device sync or export. Removing a candidate or confirming
topic deletion affects only the selected topic and has no recovery function.
Clearing site data also removes the records. Changing host or port changes the
storage origin.

Four built-in records are dated research samples. Separate October 4 and October 5
batches contain three actually read Xiaohongshu recruitment posts, summarized by
the development agent and corroborated against faculty/lab pages. They are stored
material when displayed, not a fresh search. Collection scope, partial reading,
summary versus body, and original time are retained when saved to a topic.
The application's public search uses literal matching and user-confirmed candidate
association; it has no integrated model summary, autonomous advisor identification
or current-intake verification.
The October 5 choice-support slice is usable without the API: choose
“比较本次采集的两名候选” or add Jiang/Song individually. Switch research,
graduate or short-term perspectives, optionally change the research focus and
expand each claim's specific source summaries. Primer DataTable renders one
question with named candidate rows, including narrow screens; it is imported
from the installed library's public experimental entry point. No decision engine
or new dependency was installed.

From a comparison, “补查” prefills a public query from the current perspective. The query can be edited before lookup. A successful body and a failed or fallback attempt stay explicit. Confirming a source saves it on the current topic and shows it back on the comparison as supplemental evidence. That save does not rewrite the fixed comparison text, the other topic, or an unsaved comparison draft still open in the same visit. Refresh keeps only records that were explicitly saved.

The helper src/lib/advisor-comparison.ts holds two bounded, source-bound
interpretations of the collected batch. Missing URL/batch/capture evidence
suppresses its claim; unknown eligibility never means rejection. These are
curated interpretations, not model output or a live collection. Comparisons and
perspective settings are temporary. Private reasons/questions use the selected
topic's existing storage; explicit save is required, and removing a comparison
does not remove a saved candidate. Unsaved edits disappear on refresh. New topics
created during a comparison record that question. Preparation/resources and
complete demo walkthroughs remain later slices under
[task design](../product/advisor-task-design.md#84).

## Browser Collection and Precollected Batches

For a short collection task, explicitly ask the agent to read
`tools/skills/opportunity-discovery/SKILL.md` and use the available browser.
An existing session can support normal search and reading without exporting
cookies. The selected Xiaohongshu pilot was executed with Codex browser tools;
sign-in was not performed or verified in that October 4 trial. No additional
browser framework was installed. The skill is a repository draft,
not an automatically discovered installed skill or a scheduled job.

For the user-authorized sign-in trial, distinguish unknown, signed-out and
signed-in states using visible page indicators. Reading a post does not prove
authentication, and a new tab shares its browser profile. Use a tool-supported
isolated session, or obtain explicit agreement before signing out an existing
session. Open the original site's login entry and show the tab; the user completes
QR scanning, credentials and CAPTCHA directly there. Do not retain those inputs,
QR codes or authentication screens in files or screenshots. Afterward verify
visible account/sign-out controls, then actually search and read a relevant body;
report authentication and collection results separately.

On October 5, Xiaohongshu visibly offered sign-out; the available IAB exposes only
one normal profile and no isolated context. Bilibili instead showed a signed-out
login entry. Its original-site login window was opened and shown to the user,
without signing out other sites. After the user reported completion, fresh UI
inspection found the login prompt/window gone and account navigation present.
The agent searched `如何选择研究生导师`, switched to articles, opened a relevant
result and read its text body. Sign-in verification and resumed reading both
passed in this trial. This does not establish that the article required login or
authentication will persist, test Xiaohongshu sign-in, or add a Bilibili collector
to the application. The article was reading verification only, not a new advisor
batch or requirements evidence; QR codes, credentials and account identity were
not saved in the handoff files.

The agent writes source-backed summaries to the documented batch format. Check a
batch using:

```bash
bun run discovery:validate apps/web/src/data/xhs-recruitment-2026-10-04.json
bun run discovery:validate apps/web/src/data/xhs-recruitment-2026-10-05.json
```

`apps/web/src/lib/collected-batch.ts` owns parsing. Reviewed JSON is statically
imported through `advisors.ts`, so the existing Primer candidate/detail/save paths
display it without a student login or collector credentials. Collection metadata
and the optional same-site lookup link/access note survive local topic save/reopen;
this does not change the localStorage version or
add server persistence. A new batch is not automatically published by validation.

The October 5 repeat searched `计算机系统 招生`. Jiang Zuming's post had text
and two images: text and the first image were read, the second image was not.
Song Zhuoran's recruitment information was entirely in three images, which were
read individually. Comments were excluded in both. The new batch keeps the
displayed dates and separate official corroboration; it does not replace the
October 4 capture. Multiple batches are combined by candidate identity while
preserving dated sources. Conflicting names/institutions are rejected rather
than silently merged; no background refresh or unattended collection was added.

The current webpage's search button still calls the public HTML discovery API;
it does not invoke Xiaohongshu. A browser collector adapter remains a next step if
the repeated workflow warrants it. Tool comparisons and the executed trial are
in [reuse research §9](../constraints/open-source-reuse-reference.md#9-skill).

## API Client

```bash
bun run api:types
bun --cwd packages/api-client test
```

Pages and hooks should call the API through `@campus-agora/api-client`.
Use `createCampusAgoraMockFetch()` for local mock wiring and tests.

## Repository Scripts

Shared automation lives in `scripts/`. Use the root `bun run ci:*` commands to
run the same checks that CI runs for frontend, backend, desktop, contracts,
docs, and container builds. Use `bun run build:all` for a local all-target
build check.

## Rapid Iteration for the Competition Demo

用户于2026-10-03明确偏好短反馈周期和自主执行。以下方法服务于[任务设计](../product/advisor-task-design.md#8)中的P2–P3工作，按任务大小使用。每轮以一个可操作的用户结果为单位；完整demo仍按[需求v1.0](../product/requirements-handoff.md)验收。

### 每轮怎样进行

| 当前任务 | Agent怎样开始 |
| --- | --- |
| 已明确的小修改／缺陷 | 读相关代码和适用规则，直接修改、检查、修复；无需另建任务卡或计划文档 |
| 一般功能切片 | 用几句话写清用户结果、可观察检查和真正阻断的未知，然后连续实现、运行、观察、修复；原有任务记录足够 |
| 路线未知或较大边界变化 | 只调查会改变当前实现的关键问题，给试验设投入上限；无依赖的实现同时推进，结论足够就开始接通 |

实际循环是：**做最小可操作改动 → 运行／查看真实结果 → 修正最重要的问题 → 继续到本轮用户结果成立。** 不在写完第一版、编译成功或一次检查失败后询问是否继续；检查反馈直接进入修复。具体费用、私人数据传输、需要授权的动作或会改变当前结果的缺失信息才协商，普通可逆选择由agent依据现有约束决定。

读取范围随改动确定；同一会话已读且未变化的资料复用，界面、数据或部署边界变化时再查对应约束。运行过程中先用聚焦检查保持反馈快，逻辑完成时执行受影响的必要检查；通过后无新改动、失败或未解问题就停止重复测试。独立工作可以并行，集中复查关键行为和数据边界，避免逐个微小改动多轮交接。

范围、接口、命令或交接事实变化才更新正式文档。非琐碎工作沿用[AI日志](../ai-log/todo.md)简短记录，不新增一套重复账本。试用中记录误读、人工补位和未完成项；作者操作与学生试用分开。实际外部正文、固定材料和模拟行为各自标明，运行结果才是验收依据。

### 需要交接时的短任务记录

复杂切片或跨会话工作可写“用户结果／范围、最小验收、关键未知、实际结果／下一步”；在现有任务文档或日志中记录即可。预计修改文件可帮助定位，但不是开工前必须锁定的清单。第一个切片的[任务卡](../product/advisor-task-design.md#81)用于起步交接，后续每个小改动不必照表填写。

测试投入跟随行为风险。主题持久化、数据隔离和旧查询覆盖新查询等关键逻辑需要有意义的回归检查；简单文案或可逆布局不为了形式另写测试。`apps/web`的`test`执行存储行为测试与类型检查，实际页面操作仍须浏览器走查。根`typecheck`先构建共享API client，避免Web读取旧`dist`类型。前端改动按`scripts/ci/frontend.sh`执行相关检查，API契约变化同步生成并按`scripts/ci/contract.sh`核对；文档改动按`scripts/ci/docs.sh`检查。

### 方法与skill参考

下列为已读取的一手资料和本项目的取舍，不是效率提升的实测结论。资料查阅时间：2026-10-03。

| 资料 | 能借鉴什么 | 本项目怎样使用 |
| --- | --- | --- |
| [GitLab Iteration](https://handbook.gitlab.com/handbook/engineering/workflow/iteration/) | 小而独立的逻辑改动；相关数据库与调用代码可以一起交付 | 按用户结果切片，限制每轮改动和评审范围 |
| [GOV.UK Alpha](https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works) | 只做足以测试高风险假设的原型；投票登记案例先验证400多个地方登记系统集成 | 先试真实搜索／正文读取及保存边界，整套业务不必先完成 |
| [GitLab Technical Spikes](https://handbook.gitlab.com/handbook/engineering/development/growth/technical_spikes/) | 技术试验输出发现、建议和后续任务，未必交付生产代码 | 每项试验回答一个选型问题；达到投入上限后整理结论，不无限研究工具 |
| [Basecamp Set Boundaries](https://basecamp.com/shapeup/1.2-chapter-03) | 作者报告权限问题经重审缩成一天可做的归档警告，而非六周项目 | 拆解真正影响选择的行为，控制外围工作；此案例不是本项目工期估算 |
| [OpenAI收紧skills和提示词的经验](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) | 过长skill、重复读文件和细碎指令可能拖慢工作；完成应包含运行、观察和修复 | 按需读资料，给明确完成目标后自主继续；该文针对特定模型，作为执行设计参考，不推算本项目提速 |
| [Aider自动检查与修复](https://aider.chat/docs/usage/lint-test.html) | 默认检查所修改文件；可配置测试，命令失败作为修复反馈 | 用代码／实际操作反馈驱动下一步，少靠自然语言审批；不要求每次编辑跑全仓库检查 |
| [Cursor agent使用经验](https://cursor.com/blog/agent-best-practices)及[工程调整记录](https://cursor.com/blog/continually-improving-agent-harness) | 简单／熟悉任务可直接执行；规则保持精简，反复出错再加；团队按离线评估与真实反馈调整流程 | 先做可运行切片，按实际问题增补规则和工具；官方经验没有完整对照数据，不宣称本项目会提速多少 |
| [Anthropic内部开发案例](https://www-cdn.anthropic.com/58284b19e702b49db9302d5b6f135ad8871e7658.pdf)第5–6页 | Claude Code团队使用编写、测试、修改的自主循环；Vim模式案例自述约70%最终实现来自自主执行 | 让agent能自己运行并修改结果，反馈集中在可操作版本；70%是内部访谈自述，不是速度或质量实验 |
| [OpenAI Build Skills](https://learn.chatgpt.com/docs/build-skills)、[技能评估方法](https://developers.openai.com/blog/eval-skills) | 小而专门的skill，按真实任务和成功标准检查其行为 | 长期执行偏好放在AGENTS；特殊重复任务才考虑skill，避免每个功能都触发一整套开发流程 |
| [OpenAI开发工作流案例](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex) | 有序步骤、可观察验收、执行证据与计划分开 | 借鉴短计划和结果记录；完整harness、逐步审批和多份账本不是本项目要求 |

修正本轮早先“优先借鉴writing-plans”的建议：计划技能按任务需要选，不作为每次编辑的入口。[Superpowers executing-plans](https://github.com/obra/superpowers/blob/main/skills/executing-plans/SKILL.md)当前正文强调同一会话连续执行、减少逐任务交接、最后集中复查；但还附带worktree、账本、逐任务测试先行与提交，适合只借鉴执行方式。[writing-plans](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md)、[verification-before-completion](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md)、[systematic-debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md)分别用于需要计划、核对完成证据和故障定位的情况，不能据此增加普遍审批门槛。

对快速执行候选进一步核对了正文，而不是按名称选择：

| 候选 | 可取之处与接入成本 |
| --- | --- |
| [GSD Core fast／quick](https://github.com/open-gsd/gsd-core/blob/main/docs/how-to/handle-quick-and-fast-tasks.md) | 最值得借鉴任务分流：fast直接修改、适用检查；quick的讨论／研究／独立验证按需开启。正文仍有项目初始化、计划／代理／worktree等成本，fast还自动提交并使用`git add -A`，不适合直接套在当前有混合改动的工作区。官方main当前版本1.15.0、MIT；旧`gsd-build/get-shit-done`已归档，不混称同一维护状态 |
| [Superpowers](https://github.com/obra/superpowers) | 连续执行和完成证据有用；[brainstorming](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)仍对小的创造性改动设置设计审批，writing-plans再次要求审阅。当前偏好下不启用整套自动流程，具体技能按需借鉴 |
| [BMAD bmad-build oneshot](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-build/step-oneshot.md) | 当前main的oneshot调查后直接实施，省去计划审批，适合参考短功能执行；仍有`_bmad`配置／渲染、独立评审、意图缺口问询和自动提交。main含未发布变化，不把它全称为最近发布的v6.12.0功能；MIT，品牌另有商标说明。作为候选阅读，不新增框架选型任务 |

上述均未安装或执行，没有实际提速测量。面向长期行为的偏好已写入AGENTS；保留少量专门skill比为所有开发动作装一整套流程更适合当前项目，这是结合资料和用户偏好的适用判断。

本机Superpowers缓存为v5.1.3，上游[发布记录](https://github.com/obra/superpowers/blob/main/RELEASE-NOTES.md)当前列v6.4.2；新版计划正文已简化，因此缓存与上游不能混称同一流程。本会话可用技能目录未列Superpowers：缓存可阅读，不证明已经启用。本轮只研究，没有安装或执行其工作流。复制实质技能内容时需保留其[MIT许可声明](https://github.com/obra/superpowers/blob/main/LICENSE)。

官方目录的[Playwright skill](https://github.com/openai/skills/blob/main/skills/.curated/playwright/SKILL.md)可作为后续真实界面走查候选，当前已有浏览器工具也能承担这项工作。Skill提供方法与辅助脚本，不能代替实际搜索服务、正文读取工具或应用代码。官方技能列举脚本本轮收到GitHub HTTP 403，因此这里只给出直接读取过的候选，不声称已获取完整目录或完成安装。

## Frontend Organization

The UI system is fixed by [UI 组件与视觉规范](../product/ui-system.md):
Primer React Product UI, Primer Primitives and Octicons only, with no
handwritten CSS, Tailwind, CSS Modules, inline `style`, `sx` or CSS-in-JS.
The rendered advisor page now uses Primer; the old `src/styles` files and
hand-built AppShell/Button have been removed. Library distribution CSS remains
allowed. `lint:styles` runs `apps/web/scripts/check-ui.ts` to reject handwritten
styles, style/sx/className attributes and selected incompatible imports. It
checks source patterns, not visual design or all possible bypasses.

Frontend code should stay organized by responsibility:

- `src/components/ui`: thin compositions of Primer components for shared
  loading, empty, error and permission states.
- `src/components/layout`: AppShell, Sidebar, Topbar, and status surfaces.
- `src/pages`: route-level composition.
- `src/hooks`: reusable client-side behavior.
- `src/lib`: framework-safe utilities and API wiring.

Pages should compose components. They should not hand-roll duplicate buttons,
inputs, modals, loading states, or error states.

## Design System Rules

- Use Primer Primitives tokens through Primer components; do not scatter
  literal colors or spacing in pages.
- Use Octicons for icons; do not add Lucide or other icon sets.
- Do not use bordered content cards, gradients, eyebrows or decorative
  subtitles; see the UI spec for the full list.
- Pages compose Primer layout and form components rather than one-off markup.

## API And Mock Mode

Use `@campus-agora/api-client` for API access. Do not call `fetch` directly from
deep page components.

Local mock behavior should use typed API client mocks, currently
`createCampusAgoraMockFetch()`. Mock data belongs in web app mock folders or
test fixtures, not in production API client code.

## UI Copy

Common action labels, empty states, error states, and status text should use a
consistent tone. Avoid mixing English and Chinese labels in the same product
surface unless the page has an explicit localization design.

Error messages should describe the user-facing recovery path:

- "Save failed. Check your connection and try again."
- "This name already exists."
- "You do not have permission to perform this action."

## Dependency Updates

Dependency updates should be small and reviewable:

- Update one ecosystem at a time when possible.
- Keep lockfiles committed.
- Run the affected `bun run ci:*` script.
- For major upgrades, record migration risks in the PR description.
