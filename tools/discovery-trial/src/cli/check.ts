// Connectivity check: one minimal call per service. Costs at most 1 Baidu free call,
// 1 Tavily credit, 1 tiny GLM call and 1 Jina read. Never prints keys.
import { loadConfig, requireKey } from "../config.ts";
import { describeError } from "../http.ts";
import { createBaiduSearcher } from "../providers/baidu-search.ts";
import { createJinaReader } from "../providers/jina-reader.ts";
import { chatJson } from "../providers/llm-chat.ts";
import { createTavilySearcher } from "../providers/tavily-search.ts";

const config = loadConfig();
const signal = () => AbortSignal.timeout(30_000);

const checks: [string, () => Promise<string>][] = [
  [
    "百度千帆 web_search",
    async () => {
      const hits = await createBaiduSearcher(
        requireKey("QIANFAN_API_KEY", config.qianfanApiKey),
      ).search("中国科学技术大学", { count: 1, signal: signal() });
      return `${hits.length} 条结果`;
    },
  ],
  [
    "Tavily search",
    async () => {
      const hits = await createTavilySearcher(
        requireKey("TAVILY_API_KEY", config.tavilyApiKey),
      ).search("University of Science and Technology of China", {
        count: 1,
        signal: signal(),
      });
      return `${hits.length} 条结果`;
    },
  ],
  [
    `Jina Reader（${config.jinaApiKey ? "有 key" : "免 key"}）`,
    async () => {
      const page = await createJinaReader(config.jinaApiKey).read(
        "https://example.com",
        {
          signal: signal(),
        },
      );
      return `${page.content.length} 字，${page.origin}`;
    },
  ],
  [
    `模型 ${config.llm.model}`,
    async () => {
      const result = await chatJson(
        config.llm,
        requireKey("ZHIPU_API_KEY 或 LLM_API_KEY", config.llm.apiKey),
        [{ role: "user", content: '只输出 JSON：{"ok": true}' }],
        signal(),
        64,
      );
      return `返回 ${result.content.trim().slice(0, 40)}`;
    },
  ],
];

let failed = 0;
for (const [name, run] of checks) {
  const started = Date.now();
  try {
    const detail = await run();
    console.log(`✓ ${name}：${detail}（${Date.now() - started} ms）`);
  } catch (error) {
    failed += 1;
    console.log(`✗ ${name}：${describeError(error)}（${Date.now() - started} ms）`);
  }
}
process.exitCode = failed > 0 ? 1 : 0;
