// Usage: npm run discover -- "问题" [--query "检索词" ...] [--no-baidu] [--no-tavily]
// Ctrl+C once: stop launching work and keep partial results. Twice: exit immediately.
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { RunBudget } from "../budget.ts";
import { loadConfig, requireKey } from "../config.ts";
import { describeError } from "../http.ts";
import { type Searcher, runDiscovery } from "../pipeline/discover.ts";
import { createLlmExtractor } from "../pipeline/extract.ts";
import { createBaiduSearcher } from "../providers/baidu-search.ts";
import { createJinaReader } from "../providers/jina-reader.ts";
import { createTavilySearcher } from "../providers/tavily-search.ts";
import { loadSpecimens, summarize, writeRunRecord } from "../run-log.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    query: { type: "string", multiple: true },
    "no-baidu": { type: "boolean", default: false },
    "no-tavily": { type: "boolean", default: false },
  },
});

const question = positionals.join(" ").trim();
if (!question) {
  console.error(
    '用法：npm run discover -- "我对程序正确性分析感兴趣，想找本科可以参与的科研导师"',
  );
  process.exit(2);
}
const queries = values.query?.length ? values.query : [question];

async function main(): Promise<void> {
  const config = loadConfig();
  const searchers: Searcher[] = [];
  if (!values["no-baidu"])
    searchers.push(
      createBaiduSearcher(requireKey("QIANFAN_API_KEY", config.qianfanApiKey)),
    );
  if (!values["no-tavily"])
    searchers.push(
      createTavilySearcher(requireKey("TAVILY_API_KEY", config.tavilyApiKey)),
    );
  if (searchers.length === 0) throw new Error("至少需要启用一个搜索服务");

  const controller = new AbortController();
  process.on("SIGINT", () => {
    if (controller.signal.aborted) process.exit(130);
    console.log("\n收到中止请求：停止发起新调用，保留已取得结果……（再按一次立即退出）");
    controller.abort();
  });

  const specimensPath = fileURLToPath(
    new URL("../../data/specimens.json", import.meta.url),
  );
  const budget = new RunBudget(config.limits, controller.signal);
  console.log(`开始查找：${question}`);
  console.log(
    `上限：搜索 ${config.limits.maxSearchCalls} 次 / 读取 ${config.limits.maxReads} 页 / 模型 ${config.limits.maxLlmCalls} 次 / ${config.limits.runTimeoutMs / 1000} 秒`,
  );

  const record = await runDiscovery(
    question,
    queries,
    {
      searchers,
      reader: createJinaReader(config.jinaApiKey),
      extractor: createLlmExtractor(
        config.llm,
        requireKey("ZHIPU_API_KEY 或 LLM_API_KEY", config.llm.apiKey),
        config.limits.maxCharsPerPage,
      ),
      specimens: await loadSpecimens(specimensPath),
      onEvent: (e) => {
        if (e.state === "running") return;
        const mark = { ok: "✓", failed: "✗", skipped: "■" }[e.state];
        console.log(
          `  ${mark} ${e.stage} ${e.provider} ${e.target}${e.detail ? `：${e.detail}` : ""}`,
        );
      },
    },
    budget,
  );

  const path = await writeRunRecord(config.outDir, record);
  console.log(`\n${summarize(record)}\n\n完整记录：${path}`);
}

try {
  await main();
} catch (error) {
  console.error(`查找未能开始或意外中断：${describeError(error)}`);
  process.exitCode = 1;
}
