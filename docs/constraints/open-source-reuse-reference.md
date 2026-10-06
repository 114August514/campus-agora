# 开源项目复用调研：探索、读取与个人判断

Last updated: 2026-10-05

状态：P2选型参考。10月3日依据[任务设计v0.2](../product/advisor-task-design.md)中的G1—G4核对18个项目；10月4—5日补充已有登录浏览器、skill、辅助登录与两次预采集路径，见第9节；10月5日第10节补充帮助选择的项目／成熟产品方法和两人比较推演。未安装或运行候选框架；本仓库自己的公开读取切片和小红书浏览器采集已执行，不将两者混为候选框架实测。维护证据是查阅记录，不承诺持续维护。

## 1. 本轮要支持的决定

本轮解决三个具体问题：主题保存需要复用哪些基础能力；真实外部发现怎样少写搜索／正文提取代码；完整应用中哪些资料关系和操作值得借鉴。首版仍是选导师指南及资源直达，不因为项目有聊天、团队空间或知识库就增加这些功能。

**建议先复用搜索、正文读取和存储组件，保留产品自己的领域关系与任务交互。**第一轮对照“有界的小型组件组合”和“已有研究服务”；先看实际正文与依据能否取得，再决定引入多少编排框架。下文的优先级与接入成本是根据公开接口、依赖和本产品任务作出的判断，不是集成实测。

复用分三种：

- **组件／服务接入：**调用库或独立API，保留我们自己的数据模型和Primer前端。
- **结构与方法借鉴：**借鉴集合、来源、笔记、研究步骤等关系，不搬整套应用。
- **条件性备选：**维护状态、许可、架构负担或任务距离使其不适合作为当前默认底座。

## 2. 能直接减少通用实现的组件

| 项目 | 已核对的能力与接口 | 依赖／许可 | 对本产品的用途与缺口 |
| --- | --- | --- | --- |
| [SearXNG](https://github.com/searxng/searxng) | 多搜索引擎聚合；[HTTP搜索API](https://docs.searxng.org/dev/search_api.html)可返回JSON并选择引擎／语言／时间范围 | Python服务，可用Docker；[AGPL-3.0-or-later](https://github.com/searxng/searxng/blob/master/setup.py) | 优先试验“问题→候选URL”。依赖上游引擎可达性，部分需密钥，公共实例可能禁JSON；结果摘要不等于正文 |
| [Trafilatura](https://github.com/adbar/trafilatura) | [fetch_url／extract](https://trafilatura.readthedocs.io/en/latest/corefunctions.html)，正文、元数据、表格／链接，可输出JSON／Markdown | 当前Python≥3.10；[Apache-2.0](https://github.com/adbar/trafilatura/blob/master/LICENSE)，旧版本许可不同 | 优先试静态导师主页与通知。不是通用搜索引擎；JS需先渲染，不处理PDF／OCR；[文章抽取可能遗漏短主页内容](https://trafilatura.readthedocs.io/en/latest/troubleshooting.html) |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | 异步网页读取、JS执行／等待、Markdown与选择器提取；可发现sitemap／Common Crawl URL | Python≥3.10及Playwright浏览器；[LICENSE](https://github.com/unclecode/crawl4ai/blob/main/LICENSE)为Apache-2.0文本加额外归属条款 | 作为动态页或普通抽取失败的备选。本地库／自托管server不含Web search，云端search另计；[PDF需专用策略](https://docs.crawl4ai.com/advanced/pdf-parsing/)，扫描件默认不做OCR |
| [Mozilla Readability](https://github.com/mozilla/readability) | [Readability.parse](https://github.com/mozilla/readability/blob/main/README.md)从DOM抽取标题、正文、署名等 | JS；Node另供DOM；[Apache-2.0](https://github.com/mozilla/readability/blob/main/LICENSE.md) | 若采用Node工具路线，可替代静态正文提取。它不下载、不搜索、不渲染JS、不读PDF；输出HTML仍需适当处理。与Trafilatura先择一路试验 |
| [Dexie.js](https://github.com/dexie/Dexie.js) | IndexedDB封装、索引／事务及React查询；[导入导出插件](https://github.com/dexie/Dexie.js/blob/master/addons/dexie-export-import/README.md)可独立评估 | JS／TS库；[Apache-2.0](https://github.com/dexie/Dexie.js/blob/master/LICENSE) | 适合试同一浏览器内主题、候选关联、理由／疑问保存，不需要先引入云同步。主题隔离、删除范围、保存失败及浏览器数据清除后的边界仍由我们设计 |
| [Fuse.js](https://github.com/krisk/Fuse) | 小至中型资料集的关键词／模糊检索、多字段匹配，浏览器／服务端可用 | 无运行时依赖；当前主分支[Apache-2.0](https://github.com/krisk/Fuse/blob/main/LICENSE)，不能沿用旧搜索结果中的MIT标签 | 可减少已有样稿检索代码；它不是外部搜索或领域语义理解。内部检索分数不能变成导师品质／适配分；中文、别名及跨语种匹配要检查 |

浏览器存储与服务器存储是两条备选，不默认同时建设。Dexie是局部存储工具，不自带本产品的主题／事实关系；已经有PostgreSQL／SQLx工程基础时，也应比较继续使用的成本。

PDF单独检查读取结果，不能因为工具有“PDF支持”就认为扫描、表格、全文与关键条件都已取得。初版页面样本不必同时引入两套HTML提取器和完整OCR平台。

## 3. 现成研究链路与编排

| 项目 | 可以复用／借鉴什么 | 依赖、许可和成本边界 | 本轮判断 |
| --- | --- | --- | --- |
| [GPT Researcher](https://github.com/assafelovic/gpt-researcher) | [主类](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/agent.py)将conduct_research与write_report分开；可取得sources、URLs、context及costs | 当前[Python≥3.12](https://github.com/assafelovic/gpt-researcher/blob/main/pyproject.toml)，包含LangChain／LangGraph／LiteLLM等；默认示例有模型及Tavily配置。LICENSE为[Apache-2.0](https://github.com/assafelovic/gpt-researcher/blob/main/LICENSE)，包元数据仍写MIT，固定版本时复核 | 很接近可直接试验的研究后端；只取研究所得即可，不强制生成长报告。候选／工作／途径、断言出处绑定、条件时效、私人主题及取消语义仍需我们补充 |
| [Vane，原Perplexica](https://github.com/ItzCrazyKns/Vane) | 搜索、读取、回答与引用的应用；[POST /api/search](https://github.com/ItzCrazyKns/Vane/blob/master/docs/API/SEARCH.md)支持模型／来源选择，返回message和sources，也有流式输出 | Next.js服务及SearXNG，配置模型／embedding；[MIT](https://github.com/ItzCrazyKns/Vane/blob/master/LICENSE)。可作为独立HTTP服务，旧仓库地址已重定向 | 值得作为现成服务备选。API文档把source.content描述为snippet，不能仅见引用就认定正文成功读取；需结合实际读取结果／实现核对。它不直接产出导师领域结构；整套Tailwind前端不复用 |
| [LangGraph.js](https://github.com/langchain-ai/langgraphjs) | 状态图、分支、[检查点](https://docs.langchain.com/oss/javascript/langgraph/persistence)、[中断恢复](https://docs.langchain.com/oss/javascript/langgraph/interrupts) | [MIT](https://github.com/langchain-ai/langgraphjs/blob/main/LICENSE)；核心包与包装层的[运行版本要求](https://github.com/langchain-ai/langgraphjs/blob/main/libs/langgraph-core/package.json)不同；Bun兼容待试。开源库与付费托管／模型调用分开 | 若少量步骤已够，先不引入；需要多轮补查／恢复时再评估。框架不提供搜索正文工具，也不提供本产品主题模型 |
| [Open Deep Research](https://github.com/langchain-ai/open_deep_research) | 研究简报、并行调查、[迭代／工具次数上限](https://github.com/langchain-ai/open_deep_research/blob/main/src/open_deep_research/configuration.py)、关键内容提取 | Python／LangGraph；[MIT](https://github.com/langchain-ai/open_deep_research/blob/main/LICENSE)；仓库2026-08-21归档 | 方法和代码参考，不选当前默认依赖。[读取代码](https://github.com/langchain-ai/open_deep_research/blob/main/src/open_deep_research/utils.py)在正文缺失时可用搜索摘要回退，其“完成”不能替代我们的正文读取验收 |
| [STORM／Co-STORM](https://github.com/stanford-oval/storm) | 多视角追问、来源信息表、阶段输出及重用；可只运行知识收集 | Python≥3.10，DSPy及检索／向量等依赖；[MIT](https://github.com/stanford-oval/storm/blob/main/LICENSE)，模型／搜索或本地算力成本另算 | 优先借鉴“依据已得信息补问”的方法。百科式文章生产与本任务距离较大；[阶段文件恢复](https://github.com/stanford-oval/storm/blob/main/knowledge_storm/storm_wiki/engine.py)不是任意节点恢复或用户主题保存 |

LangGraph的运行线程检查点和用户探索主题分别设计：内存saver不能满足进程重启后的保存；跨线程store与checkpointer也不是同一机制。恢复可能重跑节点，要处理重复读取／入库。官方[图API说明](https://docs.langchain.com/oss/javascript/langgraph/graph-api)中的private state也不保证自动从stream隐藏，不把原始执行状态直接当作前端输出。

GPT Researcher、Vane和LangGraph.js不必一并安装。先选择一个现成研究路径与一个小型组合路径对照；模型、搜索接口费用和国外服务可达性依实际配置检查，不使用README示例费用推算我们的每次成本。

## 4. 资料与主题组织值得借鉴的项目

| 项目 | 已确认的参考价值 | 关键差异与接入判断 |
| --- | --- | --- |
| [Zotero](https://github.com/zotero/zotero) | [同一资料进入多个集合](https://www.zotero.org/support/collections_and_tags)不复制，移除集合关联不删除其他集合的资料；有[资料子笔记／独立笔记](https://www.zotero.org/support/notes) | 最值得借鉴公共对象与集合关系。资料子笔记不等于“每个主题独立候选理由”；这层关联仍需我们实现。桌面Gecko体系不整体移植，可按需评估[Web API](https://www.zotero.org/support/dev/web_api/v3/)。[AGPLv3](https://github.com/zotero/zotero/blob/main/COPYING) |
| [Karakeep](https://github.com/karakeep-app/karakeep) | URL／笔记／图像／PDF收藏、列表、内容读取、全文／语义查询、AI标签摘要及[REST API](https://docs.karakeep.app/) | 可评估独立资料服务，或借鉴URL获取到用户保留的流水线。Next.js＋SQLite／Drizzle、浏览器读取及搜索服务有新增负担；不自带导师／途径模型，标签不等于私人判断。[AGPL-3.0](https://github.com/karakeep-app/karakeep/blob/main/LICENSE) |
| [Open Notebook](https://github.com/lfnovo/open-notebook) | Notebook组织来源、笔记、AI上下文；[手写和AI所得可保存并引用](https://github.com/lfnovo/open-notebook/blob/main/docs/3-USER-GUIDE/working-with-notes.md)，有REST API | 很适合借鉴主题工作台。[当前概念文档](https://github.com/lfnovo/open-notebook/blob/main/docs/2-CORE-CONCEPTS/notebooks-sources-notes.md)规定Source只属于一个Notebook，跨Notebook需再次添加；跨主题共用来源还在README待实现项，不能直接声称已满足我们的关系。FastAPI＋SurrealDB＋Next.js；[MIT](https://github.com/lfnovo/open-notebook/blob/main/LICENSE) |

Zotero的集合关系与Open Notebook的主题上下文可以合并为本产品的设计参考：公共对象可复用，主题内判断独立。这里借鉴的是关系与任务，不把收藏、文献管理或Notebook对话替代导师比较。

Karakeep、Open Notebook的[前端](https://github.com/karakeep-app/karakeep/blob/main/apps/web/package.json)与[依赖](https://github.com/lfnovo/open-notebook/blob/main/frontend/package.json)使用Radix／Tailwind等。它们可提供API或方法参考；本产品的UI继续按[Primer规范](../product/ui-system.md)实现。

## 5. 条件性备选与未默认采用的方案

| 项目 | 已核对事实 | 当前处理 |
| --- | --- | --- |
| [Firecrawl](https://github.com/firecrawl/firecrawl) | 搜索／scrape／crawl／map的一体API；[server AGPL-3.0](https://github.com/firecrawl/firecrawl/blob/main/LICENSE)，[JS SDK MIT](https://github.com/firecrawl/firecrawl/blob/main/apps/js-sdk/LICENSE)。[自托管](https://docs.firecrawl.dev/contributing/self-host)不等于云版本：默认无Fire-engine、截图／page actions等；默认栈包含Node、浏览器、Redis、RabbitMQ、PostgreSQL | 保留一体服务备选，先比较部署和适配成本。当前[搜索代码](https://github.com/firecrawl/firecrawl/blob/main/apps/api/src/search/index.ts)可走Fire-engine、SearXNG或DuckDuckGo；默认无需据此断言必买搜索API，也不能许诺上游稳定免费。云PDF/OCR能力与计费不代替自托管核对 |
| [Open WebUI](https://github.com/open-webui/open-webui) | 文件夹／项目、网页搜索与[持久Notes](https://docs.openwebui.com/features/notes/)可参考；当前为[自定义Open WebUI License](https://github.com/open-webui/open-webui/blob/main/LICENSE)，有品牌保留等条款，不是普通MIT／BSD | 以任务组织参考为主。Notes文档说明管理员默认可看笔记，不能套用成我们的私人边界；Svelte／Tailwind及聊天中心结构整体改造较大 |
| [Onyx](https://github.com/onyx-dot-app/onyx) | 多应用连接、索引、检索和AI工作台；[LICENSE](https://github.com/onyx-dot-app/onyx/blob/main/LICENSE)区分MIT部分与ee目录的企业许可 | 可借鉴连接器和来源追踪。本轮有限公开来源探索用不到其完整组织知识平台；不默认接入，不能只看根目录许可就复制ee代码 |
| [PyAlex](https://github.com/J535D165/pyalex) | [MIT](https://github.com/J535D165/pyalex/blob/main/LICENSE)的OpenAlex Python客户端；作品／作者／机构检索、过滤和标识关联 | 作为导师“研究什么”的结构化数据补充，或直接调用OpenAlex API。不是招生／指导关系数据库；同名、机构时期及本人关联仍需核对。所读[官方认证说明](https://help.openalex.org/api/authentication/)允许少量无key查询，规模使用需按key／额度处理；SDK README的额度／必需key表述与其不完全一致，采用时以官方接口规则及实际响应核对 |

OpenAlex元数据、已收录资料检索、给定URL导入和主动搜索新网页是不同能力；只接资料库或学术索引不足以证明已跑通我们的外部发现。

Firecrawl所读内部search函数捕获异常后可返回空数组；试验需核对实际API的错误／状态输出，不能只按空列表判“无匹配”。若接口没有保留失败原因，接入层需补充可辨认的搜索失败依据。这是该函数的行为，不概括为所有Firecrawl API都隐藏错误。

## 6. 维护证据与读取边界

查阅日期均为2026-10-03。以下记实际能读到的发布／归档／更新证据，不把stars、仓库存在或某次页面抓取日期当作活跃维护证明。发布页未给年份时保留其显示方式，不补推断年份，也不宣称等于最新HEAD。

| 项目 | 本次可读证据 |
| --- | --- |
| SearXNG | [commit页](https://github.com/searxng/searxng/commits/master/)有2026-09-11引擎修复；所读官方文档版本2026.10.2+19ffbcd30 |
| Trafilatura | [发布页](https://github.com/adbar/trafilatura/releases)显示v2.3.0、02 Oct 16:53；正文未给年份 |
| Crawl4AI | [v0.9.4](https://github.com/unclecode/crawl4ai/releases/tag/v0.9.4)，README明确2026-09-23 |
| Readability | [CHANGELOG](https://github.com/mozilla/readability/blob/main/CHANGELOG.md)有0.6.0、2025-03-03；未据此判停维护 |
| Dexie | [发布页](https://github.com/dexie/Dexie.js/releases)显示4.4.6、10 Sep 13:45，含保存／导出等修复；正文未给年份 |
| Fuse | [CHANGELOG](https://github.com/krisk/Fuse/blob/main/CHANGELOG.md)明确7.4.0、2026-05-30；[发布页](https://github.com/krisk/Fuse/releases)另有7.5.0、13 Jul，未补年份 |
| GPT Researcher | [发布页](https://github.com/assafelovic/gpt-researcher/releases)显示v3.7.0、26 Sep 17:46，内文对应Python包0.16.0；正文未给年份，固定版本需分清发布标签与包版本 |
| Vane | [发布页](https://github.com/ItzCrazyKns/Vane/releases)显示v1.12.2、10 Apr 13:30；含Chromium读取、超时与流错误修复；正文未给年份 |
| LangGraph.js | [发布页](https://github.com/langchain-ai/langgraphjs/releases)核心1.4.18、25 Sep 03:17；正文未给年份 |
| Open Deep Research | [仓库](https://github.com/langchain-ai/open_deep_research)明确2026-08-21归档只读 |
| STORM | [README](https://github.com/stanford-oval/storm)新闻2025年1月／1.1.0；setup写1.1.1。未核对最新commit，不据此判停维护 |
| Zotero | [官方版本记录](https://www.zotero.org/support/changelog)10.0.5、2026-09-30 |
| Karakeep | [组织页](https://github.com/karakeep-app)主仓库Updated Sep 29, 2026，是仓库更新时间；[发布页](https://github.com/karakeep-app/karakeep/releases)0.33.2／11 Aug，未补年份 |
| Open Notebook | [CHANGELOG](https://github.com/lfnovo/open-notebook/blob/main/CHANGELOG.md)v1.14.0标2026-07-20；[发布页](https://github.com/lfnovo/open-notebook/releases)显示21 Jul，保留二者差异 |
| Firecrawl | [发布页](https://github.com/firecrawl/firecrawl/releases)v2.11.0／19 Jun，未给年份；自托管文档另指定v2.11.162，不混成一个版本 |
| Open WebUI | [v0.11.4发布页](https://github.com/open-webui/open-webui/releases/tag/v0.11.4)，[发布API](https://api.github.com/repos/open-webui/open-webui/releases/latest)返回2026-09-21 UTC |
| Onyx／PyAlex | 本轮读README、许可及相关接口说明，没有取得可用于精确比较的最新提交日期；正式采用前再固定版本核对 |

已阅读表中所引README／文档／LICENSE正文，工作流层另读agent、配置或提取相关代码；没有完整审阅所有源码或传递依赖许可。许可按本次所读内容记录：Crawl4AI有额外归属条款，GPT Researcher存在包元数据冲突，Open WebUI与Onyx不能只用一个宽松许可标签概括。正式采用时固定版本，保留其相应声明；本调研没有改变本仓库Apache-2.0许可。

README中的“免费”“准确”“私密”“高性能”等属于项目自述，本轮没有采用为效果结论。云模型、外部搜索、浏览器运行、存储与自托管分别产生实际成本或资源需求，开源许可不等于免费服务。

## 7. 本仓库已有资产与首轮复用

10月3日盘点工程，10月4日已实施一轮有限复用：

- React／Vite／TypeScript和API客户端已复用，Web已迁移到Primer探索任务；历史独立HTML仍不能作为合规样式模板。
- Rust／Axum已增加实际公开搜索／静态HTML读取接口，失败时可读取有限官方目录；不是登录浏览器采集接口。主题采用同源localStorage，未引入Dexie、SQLx持久化或新数据库。
- 旧迁移为users、posts、post_revisions、audit_events，不是导师／工作／参与途径／主题模型；不把帖子表换几个标签就作为默认领域关系。
- Python或Node组件可以按库／独立进程／HTTP服务接入。是否保留Rust服务、如何部署与存储，结合小试验决定；未授权或完成后端替换。

工程检查与浏览器走查记录见[AI日志](../ai-log/done.md)；未运行数据库迁移或生产环境验收。现有四人内容样稿继续复用，与10月4日真实采集批次分别标识，既有资料不冒充展示时的新抓取。

## 8. 建议的有限试验

从以下两种路径选小范围对照，不同时建设全部项目：

| 路径 | 起点 | 要检验什么 |
| --- | --- | --- |
| 小型组件组合 | SearXNG → Trafilatura；确需JS／PDF时补Crawl4AI；研究说明＋少量AI结构化操作 | 搜索与正文读取能否分别返回真实结果，关键条件／链接是否保留，所需胶水代码和实际运行成本 |
| 现成研究服务 | GPT Researcher的research-only库路径；若偏HTTP／Node部署，可用Vane替代参与对照 | 实际正文与出处是否可取得，能否映射成候选／工作／途径／未知，取消／部分失败是否可解释，是否省下足够集成工作 |

两条路径共同使用同一个用户问题与输出要求：发起条件、实际取得的URL／正文、相关具体陈述、原文依据、候选／作品／途径关联、未知、读取状态和时间。保存失败、正文缺失、搜索摘要回退都可辨认；只返回一篇流畅答案或引用链接不算通过。先不要求完整向量数据库、多agent或全文站点归档。

读取样本从现有来源选少量：中文导师主页、英文lab页、招募通知、短目录页；补一个确需动态渲染的页面和一个文本PDF，仅在影响工具选择时测试。检查关键陈述是否保留、来源是否真实、身份关联和当前开放是否被误写；记录耗时和实际配置费用，不设未经验证的节时目标。

G1另做一项小试验：若选浏览器保存，用Dexie保存两个主题，共用一个候选，分别保留依据、理由／疑问；关闭重开、修改和删除一个主题后检查另一主题。若选服务器存储，用同样任务验证已有SQLx路径。Zotero与Open Notebook帮助理解关系，不能代替这项产品检查。

**仍需自行实现的产品价值：**问题与偏好如何影响发现，人物／作品／参与途径如何关联，依据、冲突和未知如何解释，比较怎样支持当前问题，公共事实与主题内私人判断怎样分离，以及按需交流／准备／资源如何接续。这些领域选择不交给通用研究应用自动决定。

以上为10月3日的有限对照建议；10月4日已用现有工具完成第一小段，避免据此再次要求从零选型。候选库尚未作为依赖采用，不新增长期维护或问卷前置要求。

## 9. 已有登录浏览器、调研skill与预采集展示

本轮改善G2的具体决定：如何读取站内招生线索，并把一次收集的成果复用给学生。用户选定小红书招生帖作为首个浏览器案例，希望复用已有登录会话；10月4日实际使用的是当时可用会话，未进行或核实登录。**建议先复用当前可用浏览器，由领域skill组织搜索和核对，固定程序校验批次，前端直接展示。**这是依据接口和本轮小试验作出的适用判断；不意味着所有网站适合相同操作或已经建成无人值守服务。

| 路径 | 一手资料核对 | 对本项目的取舍 |
| --- | --- | --- |
| 现有agent＋浏览器工具＋领域skill | [OpenAI技能文档](https://learn.chatgpt.com/docs/build-skills)将指令、脚本和资源组合；skill本身不提供浏览器。当前Codex工具可读取已连接浏览器的呈现内容 | 本轮实际采用，无需再安装框架。调研结果写为公开批次，私人主题判断仍留在原存储 |
| [Playwright MCP extension](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md) | 连接现有浏览器、选择标签页，复用profile登录；[MCP配置](https://github.com/microsoft/playwright-mcp)提供`--extension`，Apache-2.0 | 可供其他agent复现通用浏览器路径；安装／连接未执行。连接已有会话不要求先导出cookies |
| [agent-browser](https://agent-browser.dev/cdp-mode) | CDP接入已运行浏览器；无URL的`read`读取当前已登录标签页，带URL的`read`是HTTP获取，见[命令说明](https://agent-browser.dev/commands)；[Apache-2.0](https://github.com/vercel-labs/agent-browser/blob/main/LICENSE) | 页面流程稳定后，可固定重复动作。浏览器session与产品探索主题分别处理；未安装或运行 |
| [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) | [搜索／详情工具](https://github.com/xpzouying/xiaohongshu-mcp/blob/main/mcp_server.go)现成；[浏览器源码](https://github.com/xpzouying/xiaohongshu-mcp/blob/main/browser/browser.go)启动自己的浏览器并装载cookies文件，Apache-2.0 | 不是直接接管日常浏览器登录的方案。已有该服务登录时可比较，不为本次试验另建会话 |
| [Auto-Claw-CC xiaohongshu-skills](https://github.com/autoclaw-cc/xiaohongshu-skills) | [CLI](https://github.com/autoclaw-cc/xiaohongshu-skills/blob/main/scripts/cli.py)＋[本地bridge](https://github.com/autoclaw-cc/xiaohongshu-skills/blob/main/scripts/xhs/bridge.py)＋公开扩展连接用户浏览器；Python≥3.11、uv、Chrome，MIT | 同时提供skill与可调用程序，匹配已有登录状态的本地路径。它是原版推荐的另一个作者项目；未安装。其CLI也有发布互动功能，采集适配只需搜索／详情 |
| [x-mcp](https://github.com/xpzouying/x-mcp) | 扩展复用日常浏览器，但需作者站点注册Token、云端MCP；[隐私说明](https://github.com/xpzouying/x-mcp/blob/main/PRIVACY_POLICY.md)说明操作参数／结果经过其后端。公共仓库未见完整实现及LICENSE | 不作为已核实可纯本地部署的开源适配器；不默认引入额外云中转 |

Chrome接入不能笼统说“默认profile无法复用”：136的限制针对启动参数开放默认数据目录调试端口，见[变更说明](https://developer.chrome.com/blog/remote-debugging-port)；当前官方另提供[现有会话接入](https://developer.chrome.com/docs/devtools/agents/use-cases/auto-connect)。具体浏览器版本、扩展和连接情况在实际采用时核对，本次未修改用户的Chrome调试配置。

### 本轮实际结果与可复现产物

2026-10-04在当前可用的Codex内置浏览器正常会话中搜索“人工智能 导师 招生”，打开[顾尚定招生帖](https://www.xiaohongshu.com/explore/6a7574850000000024024a50)，读取标题、文字部分与相对编辑时间；未逐张读十张配图或收录评论。[交大教师名录](https://www.cs.sjtu.edu.cn/jiaoshiml/gushangding.html)核对姓名、机构、研究方向和实验室主页。名录相符不能认证小红书账号本人身份，招生意向、当前名额和实际指导体验仍须区分。本轮证明当前会话下的一次搜索／阅读可行，没有验证登录，不能推断可接管用户另一Chrome会话或之后持续成功。

2026-10-05已跑通“未登录会话→agent打开原站登录→用户辅助完成→agent继续搜索／读帖”。小红书菜单可见退出登录，工具只提供一个普通IAB profile，没有隔离context；另选明确显示“登录”和未登录提示的B站，没有退出现有会话。agent打开并显示原站登录窗口；用户报告已完成，随后重新读取界面确认登录窗口／提示消失、账号空间及收藏／历史等入口出现，仅记录状态。然后站内搜索“如何选择研究生导师”，切换专栏，打开[如何选择合适的硕士生导师？](https://www.bilibili.com/opus/239879292194055258)并读取文字正文；原专栏编号为`cv2411843`，页面显示公开作者“张布衣的小仙女”和2019-04-08 10:14。这篇文章仅验证技术读页，不加入导师批次或需求证据。

本次分别验证了辅助登录和接续读取，不证明文章必须登录才能读、以后会话一定有效、小红书登录已跑通或应用已内置B站采集器。交接步骤已补入skill及[开发说明](../engineering/development.md#browser-collection-and-precollected-batches)，不在交接文档中收录二维码、凭据或账号身份。

同日又执行一次小红书搜索“计算机系统 招生”，从结果打开[江祖铭招生帖](https://www.xiaohongshu.com/explore/6a6ec878000000003302c3c2)及[宋卓然招生帖](https://www.xiaohongshu.com/explore/6aae08600000000026014ac1)。江帖文字正文和首张主页截图已读，第二张招生图未读；宋帖没有招生文字正文，逐张读取三张图，得到2027级工程博士／硕士、联合培养与相关技术经验线索。两帖评论均未纳入。不是仅凭搜索标题补齐招生条件。

[HKU教师页](https://www.cs.hku.hk/people/academic-staff/jzuming)及其链接的[主页](https://jzuming.github.io/)互证江祖铭身份、系统／安全／软件方法和PhD／RA机会；[成员页](https://jzuming.github.io/lab.html)提供公开组内研究线索，不是体验评价。[SJTU教师页](https://www.cs.sjtu.edu.cn/jiaoshiml/songzhuoran.html)与[主页](https://songzhuoran.github.io/)支持宋卓然AI系统／体系结构方向；教师页标题“副研究员”和正文“副教授”冲突保留，主页未确认帖子招生类别或名额。2027年、资格、资助与剩余名额分别按来源归属或留待确认，账号身份和指导质量不由姓名相符推导。

- 调研指令：仓库`tools/skills/opportunity-discovery/SKILL.md`及批次格式参考；需显式让agent读取，未安装到自动发现目录。
- 真正执行的采集记录：`apps/web/src/data/xhs-recruitment-2026-10-04.json`，一人、两来源，文字已读／配图未全读，保存的是整理摘要。展示时属于预采集资料。
- 第二批：`apps/web/src/data/xhs-recruitment-2026-10-05.json`，两人、七来源，覆盖文字与纯图片版式；保留原显示“编辑于 08-02”“编辑于 09-21 上海”和各自读取范围。展示时同样是预采集资料。
- 固定复用部分：`parseCollectedBatch`校验版本、结构、来源及批次元信息，`bun run discovery:validate <batch.json>`可独立验证；前端复用现有候选详情与个人保存，不让学生暴露采集者登录。

产物不含cookie、访问令牌、私信或读者账号导出。10月4日直接打开无站内上下文的原帖短链接显示不可用；按完整标题进行站内搜索可定位同一帖。10月5日从实际站内查询结果打开两帖，没有另行验证其无上下文直链。各批保存原帖标识和已执行的查找入口；原站仍可能要求登录。相对时间保留采集时原显示，不因后续列表时间变化覆盖旧快照。当前网页“查找”按钮仍走已有公开搜索API，小红书路径由开发agent按skill执行，不假装网页已经自动调用小红书采集器。

复用两次已执行的资料支持候选研究／参与比较，再决定哪些稳定动作值得固定成适配器。纯图片招生已说明只提取文字DOM不够；当前skill已能指导agent按需看图，因此不先建设通用爬虫平台、调度后台或全网资料库。

## 10. 帮助选择：个人取舍、依据比较与导师匹配

2026-10-05用户要求先探索相关项目。本节改善T2—T4/N05的具体决定：从“已有候选资料”进到“按我的问题理解差异、保留选择理由、决定下一步”，需要借鉴什么方法或代码。查阅公开项目说明、skill源码、架构与许可；未安装、运行候选项目或上传私人资料。以下成熟产品功能、开源实现和本项目推论分别标明，方法相似不等于导师选择收益已验证。

### 10.1 优先借鉴的四项

| 项目／类型 | 一手资料中已有的能力 | 本项目怎样借鉴／哪些不能直接照搬 |
| --- | --- | --- |
| [Research Application Toolkit](https://github.com/xujingchen1996/research-app-toolkit)／领域skill | [Codex professor-match 源码](https://github.com/xujingchen1996/research-app-toolkit/blob/main/codex/skills/professor-match/SKILL.md)组织兴趣、目标范围、学位／时期；查看近期2—3年论文／项目，比较个人经历、技术栈与研究内容，输出匹配理由；招募不明时明确留空。是具体指令模板，未证明可靠匹配模型。 | 最贴近我们的选择帮助方法，可借鉴“问题→近期工作→与自身兴趣的连接→比较理由”。它建议先分析CV、输出fit level，[school-select](https://github.com/xujingchen1996/research-app-toolkit/blob/main/codex/skills/school-select/SKILL.md)还要求fit score与Reach/Match/Safety；本轮保持轻入口，不要求先交CV或产生录取概率／导师总分。 |
| [Entscheidungsnavi](https://entscheidungsnavi.com/)／个人决策工具 | [白皮书](https://entscheidungsnavi.de/whitepaper_entscheidungsnavi_en/)说明决策问题、目标、备选、后果表、偏好评价，可以回头修订；有Starter简化模式、不精确偏好及敏感性分析。 | 借鉴“我在意什么→候选在这些方面有什么差异→偏好变化时取舍怎样变化”。其完整流程与量化评价并非我们的强制步骤；可只比较当前关心的一个问题。 |
| [Google Notebook 来源工作台](https://support.google.com/gemininotebook/answer/16206563?hl=en)／成熟产品交互参考 | 这次从NotebookLM相关帮助进入，当前官方页显示Gemini Notebook。原生Data Tables可用提示自定义行列，导出时保留引用；[问答](https://support.google.com/gemininotebook/answer/16179559?hl=en)可限定来源、查看引用片段和原文上下文；[笔记](https://support.google.com/gemininotebook/answer/16262519)区分手写与保存的回答。 | 借鉴按当前问题组织比较表、每项回到依据、选择来源范围、保存结果。是产品方法参考，无可复制的开源比较组件；未核实导师选择、招生规则核验或可靠排序。私人理由保持主题内记录，不默认转成公共来源。 |
| [Argdown](https://argdown.org/)／论证结构与JS/TS解析器 | [语法](https://argdown.org/syntax/)支持正反理由、前提／结论、支持／反对关系、链接和自定义元数据；[应用接入](https://argdown.org/guide/using-argdown-in-your-application.html)提供解析流程。 | 借鉴“公开事实→对当前问题的解释→我保存的理由”。可以展示保留／暂缓某候选的具体原因；无需先做论证关系图或新增专用编辑器。解析器不会查证招生、生成经历证据或决定个人偏好。 |

可复用性核对：Toolkit的[LICENSE](https://github.com/xujingchen1996/research-app-toolkit/blob/main/LICENSE)实际为MIT，[包声明](https://github.com/xujingchen1996/research-app-toolkit/blob/main/package.json)版本0.2.3-3、Node≥20；本文只读其模板，不执行安装器或调用外联功能。[共享memory](https://github.com/xujingchen1996/research-app-toolkit/blob/main/codex/memory.md)是一份申请画像，不能原样替代多个独立探索主题。Argdown的[项目说明](https://github.com/argdown/argdown#credits-and-license)与[core包声明](https://github.com/argdown/argdown/blob/main/packages/argdown-core/package.json)均写MIT，core版本2.0.2；本次未取得独立LICENSE正文，若实际采用解析器再固定版本核对。

Entscheidungsnavi的[根LICENSE](https://gitlab.com/reflektiert-entscheiden/entscheidungsnavi/-/blob/main/LICENSE)与[官网](https://entscheidungsnavi.com/about-eng/)为AGPL v3，但[package.json](https://gitlab.com/reflektiert-entscheiden/entscheidungsnavi/-/blob/main/package.json)写ISC，元数据冲突保留。实际代码为Angular/NestJS/Nx、包版本8.4.0，不能作为Primer React组件直接加入。[公开提交API](https://gitlab.com/api/v4/projects/32555934/repository/commits?ref_name=main&per_page=1)读取main提交为2026-09-30、4239ace8840cefa945cf80f5aa7edb5964e931d8。这是查阅时该分支状态，不保证后续维护或项目效果。

### 10.2 计算与引用的条件性代码参考

| 项目 | 已读到什么 | 本轮取舍 |
| --- | --- | --- |
| [SilverDecisions](https://github.com/SilverDecisions/SilverDecisions) | 浏览器决策树、编辑／保存／加载、多准则与敏感性分析；[开发指南](https://github.com/SilverDecisions/SilverDecisions/wiki/Developer%27s-guide)区分模型、计算和编辑模块；实际[LGPL v3](https://github.com/SilverDecisions/SilverDecisions/blob/master/LICENSE.txt)，jQuery/D3体系。[master提交](https://github.com/SilverDecisions/SilverDecisions/commits/master/)可见2022-05-15 | 借鉴改变假设后看结论是否改变。缺少可解释的概率／效用输入时，不以决策树计算导师品质；当前无须接入。 |
| [MakeDecision](https://github.com/jwieckowski/makeDecision) | 可编辑矩阵／权重，导入JSON/CSV/XLSX并比较多种MCDA算法；[MIT](https://github.com/jwieckowski/makeDecision/blob/main/LICENSE)，React18/MUI/Emotion与独立[Python计算服务](https://github.com/jwieckowski/makeDecision-server)。[main提交](https://github.com/jwieckowski/makeDecision/commits/main/)可见2024-11-18 | 在以后有明确可比数值、用户确实需要权重分析的任务中再评估；当前导师资料不支持综合数字评分，不引入整套UI或新后端。 |
| [SurfSense](https://github.com/MODSetter/SurfSense) | [Chat架构](https://github.com/MODSetter/SurfSense/blob/main/docs/architecture/chat.md)说明每轮document_ids限定、保存时稳定chunk引用及邻近上下文；chat不带工具、未实现follow-up suggestions。本次相关源文件未成功取得，未作运行验证。根[LICENSE](https://github.com/MODSetter/SurfSense/blob/main/LICENSE)为Apache条款加proprietary目录BSL例外 | 引用定位和主题内来源范围可作为未来代码路线；它仍是来源问答，不自带选导师决策模型。先借鉴引用关系，整个工作台不是当前依赖。 |

这些项目的现成UI不能覆盖[Primer规范](../product/ui-system.md)。需要复用的是明确的指令、数据关系或计算／检索接口；主题判断、适用时期、招生条件与公开交流关系仍由本产品组织。框架存在不是增加图谱、评分或完整画像的理由。

[CSRankings主页](https://csrankings.org/)允许按计算机研究领域与时期缩小候选范围，并沿作品了解研究活动；[FAQ](https://csrankings.org/faq)明确受众含潜在CS研究生、指标为限定会议的发表。它能帮助定位研究活跃的对象，不能回答个人适配或指导体验。其公开代码／数据许可为CC BY-NC-ND 4.0，作者FAQ明确限制衍生分发；本轮仅以原站入口与交互作参考，不将其当作可自由复制的开源数据组件。

### 10.3 对当前两名候选的小型设计推演

以下复用10月5日已采集的资料，是作者构造的选择帮助样例，不是新采集、运行中的AI建议或学生试用。比较的是“下一步先了解什么”，并不替学生定最终导师。

| 当前想弄清的事 | 江祖铭／香港大学 | 宋卓然／上海交通大学 |
| --- | --- | --- |
| 研究内容如何区别 | 测试、形式验证、程序分析与数据库／系统安全，以及AI与系统结合，见[HKU教师页](https://www.cs.hku.hk/people/academic-staff/jzuming) | AI系统、VLA/LLM加速、GPU与软硬件协同，见[个人主页](https://songzhuoran.github.io/) |
| 哪条参与途径有说明 | [个人主页](https://jzuming.github.io/)说明有资助的PhD/Postdoc/RA机会；2027年来自招生帖，具体资格仍待查 | 已读招生图提出2027级工程博士／硕士联合培养；学位、学院规则和当前名额未互证，不能从教师主页补出答案 |
| 已有哪些准备线索 | 主页建议通过公开入口提供CV与研究兴趣／计划；不能据此推导必须已有论文 | 图中欢迎相关编程／GPU／系统基础，不表示列举的技术必须全部掌握 |
| 下一项信息会影响选择什么 | RA是否接收外校学生、具体课题及近期代码／论文，可影响短期尝试是否可行 | 联合培养类别与资格、偏系统还是偏应用的具体项目，可影响是否对应当前目标 |

根据已读资料可以给出**条件化的探索建议**：若当前更关心软件可靠性／数据库／安全，优先细读江的相关工作；若更关心AI Infra／GPU加速，优先细读宋的系统工作。这是研究内容与兴趣的连接解释，不是导师好坏或录取判断。若用户关注的是日常指导方式，目前两者的独立经历依据均不足，应保留疑问并按需找到合适的公开交流线索，而不是强行选一个。

### 10.4 建议的下一轮与最小深度

采用“当前问题／可修改关注点＋候选差异表＋来源＋私人理由／待问项”的小切片，复用现有候选、来源与主题存储。少量关注点可边看边补，不要求完成问卷；研究兴趣、参与目的与硬条件分别处理，不把兴趣不明或条件未知写成不适合。

下一轮可先明确选择帮助的skill／输出约定：固定程序读取、关联已有来源并校验结果；AI辅助解释与补查；Primer展示对照与依据。通用决策库只有在需要可解释的数值计算时才引入。先以现有两人检查以下结果：

1. 同一问题下看得出具体研究和参与途径的差异；每项解释能回到支持它的来源，未知不是零分。
2. 从“了解研究方向”改成“先做短期科研”或“申请研究生”后，解释和待查问题变化，公共事实及原私人文字保留；不能仅改一个总分。
3. 已有来源能回答时直接复用；关键条件缺失时只补查会改变下一步的少量问题，没有答案可以暂缓或结束。
4. 用户决定是否保存理由、继续了解或联系；AI建议不自动变成私人偏好，也不自动发消息。

比较UI、模型接入和自动建议尚未实现。本次先完成复用取舍，不把项目清单、样例文本或领域skill当作已测学生收益。此方法可供以后实习、竞赛等选择场景参考，不新增当前首版范围。
