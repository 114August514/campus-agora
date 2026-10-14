import assert from "node:assert/strict";
import { test } from "node:test";
import { RunBudget } from "../src/budget.ts";
import { DEFAULT_LIMITS } from "../src/config.ts";
import {
  type Extractor,
  type Reader,
  type Searcher,
  runDiscovery,
} from "../src/pipeline/discover.ts";
import { parseExtraction } from "../src/pipeline/extract.ts";
import type { PageRead, SearchHit } from "../src/types.ts";

const PAGE_TEXT =
  "张三，某大学计算机系教授，研究程序正确性分析。欢迎本科生联系参与科研。";

function fakeSearcher(id: Searcher["id"], urls: string[]): Searcher {
  return {
    id,
    async search(query) {
      return urls.map(
        (url, i): SearchHit => ({
          provider: id,
          query,
          rank: i + 1,
          title: url,
          url,
          snippet: "",
        }),
      );
    },
  };
}

const reader: Reader = {
  async read(url) {
    if (url.includes("broken")) throw new Error("HTTP 502");
    return {
      url,
      finalUrl: url,
      title: "t",
      content: PAGE_TEXT,
      retrievedAt: "2026-10-14T00:00:00Z",
      origin: "live",
      warnings: [],
    };
  },
};

const modelOutput = JSON.stringify({
  relevant: true,
  relevance_reason: "介绍了程序正确性方向的导师",
  candidates: [
    {
      name: "张三",
      affiliation: "某大学",
      homepage: null,
      research_topics: ["程序正确性分析"],
      relation_to_question: "方向一致",
      routes: [
        {
          kind: "undergrad_research",
          description: "欢迎本科生",
          status: "explicit",
          quote: "欢迎本科生联系参与科研",
        },
      ],
      evidence: [
        { quote: "研究程序正确性分析", supports: "研究方向" },
        { quote: "张三是该领域最好的导师", supports: "编造的评价" },
      ],
      unknowns: ["当前是否有名额"],
    },
  ],
});

const extractor: Extractor = {
  async extract(_question, page: PageRead) {
    return parseExtraction(modelOutput, page, 20_000);
  },
};

const deps = (searchers: Searcher[]) => ({
  searchers,
  reader,
  extractor,
  specimens: [],
});

test("a failed source is recorded and the run continues; repeated pages merge into one candidate", async () => {
  const budget = new RunBudget(DEFAULT_LIMITS, new AbortController().signal);
  const record = await runDiscovery(
    "程序正确性导师",
    ["程序正确性导师"],
    deps([
      fakeSearcher("baidu", ["https://a.edu/zhang", "https://broken.edu/x"]),
      fakeSearcher("tavily", ["https://www.a.edu/zhang/", "https://b.edu/zhang"]),
    ]),
    budget,
  );
  assert.equal(record.status, "completed");
  assert.equal(record.failures.length, 1);
  assert.equal(record.failures[0].stage, "read");
  assert.equal(record.reads.length, 2, "duplicate URL across providers is read once");
  assert.equal(
    record.outcomes.length,
    1,
    "same person from two pages is one candidate",
  );
  assert.equal(record.outcomes[0].kind, "new");
  const evidence = record.outcomes[0].candidate.evidence;
  assert.equal(
    evidence.find((e) => e.quote.includes("最好的导师"))?.quoteVerified,
    false,
  );
  assert.equal(
    evidence.find((e) => e.quote.includes("程序正确性"))?.quoteVerified,
    true,
  );
});

test("hitting the declared model-call limit stops new work but keeps partial results", async () => {
  const budget = new RunBudget(
    { ...DEFAULT_LIMITS, maxLlmCalls: 1 },
    new AbortController().signal,
  );
  const record = await runDiscovery(
    "q",
    ["q"],
    deps([
      fakeSearcher("baidu", ["https://a.edu/1", "https://a.edu/2", "https://a.edu/3"]),
    ]),
    budget,
  );
  assert.equal(record.status, "limit-reached");
  assert.equal(record.extractions.length, 1);
  assert.equal(record.outcomes.length, 1);
});

test("cancellation during a read discards the late result and keeps earlier work", async () => {
  const controller = new AbortController();
  let reads = 0;
  const slowReader: Reader = {
    async read(url, opts) {
      reads += 1;
      if (reads === 2) controller.abort(); // user cancels while the 2nd read is in flight
      return reader.read(url, opts);
    },
  };
  const budget = new RunBudget(DEFAULT_LIMITS, controller.signal);
  const record = await runDiscovery(
    "q",
    ["q"],
    {
      ...deps([
        fakeSearcher("baidu", [
          "https://a.edu/1",
          "https://a.edu/2",
          "https://a.edu/3",
        ]),
      ]),
      reader: slowReader,
    },
    budget,
  );
  assert.equal(record.status, "cancelled");
  assert.equal(record.reads.length, 1, "late 2nd read is not written after cancel");
  assert.equal(record.extractions.length, 1);
});
