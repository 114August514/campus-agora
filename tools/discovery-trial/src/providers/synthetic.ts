// SYNTHETIC providers for exercising the real pipeline (limits, cancel, failure
// continuation, quote checks, merge) without API keys. Every response the server
// produces in this mode is labelled `mode: "synthetic"`; never present it as discovery.
import type { Extractor, Reader, Searcher } from "../pipeline/discover.ts";
import { parseExtraction } from "../pipeline/extract.ts";
import type { PageRead, SearchHit, SearchProviderId } from "../types.ts";

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

const PAGES: Record<string, { title: string; content: string; cached?: boolean }> = {
  "https://example.org/lab-a": {
    title: "示例页面 A（合成）",
    content:
      "王翔，中国科学技术大学。研究方向包括大模型知识编辑：修改模型中的错误知识，同时尽量保留其他知识。示例人物A，示例大学计算机系，研究程序正确性分析与自动验证。欢迎本科生联系参与科研。",
  },
  "https://example.org/news-b": {
    title: "示例页面 B（合成）",
    content: "新闻：王翔老师介绍了大模型知识编辑方面的工作。",
    cached: true,
  },
};

const EXTRACTIONS: Record<string, unknown> = {
  "https://example.org/lab-a": {
    relevant: true,
    relevance_reason: "页面介绍了与问题方向相关的研究者（合成）",
    candidates: [
      {
        name: "王翔",
        affiliation: "中国科学技术大学",
        homepage: null,
        research_topics: ["大模型知识编辑"],
        relation_to_question: "研究方向与问题相关",
        routes: [],
        evidence: [{ quote: "研究方向包括大模型知识编辑", supports: "研究方向" }],
        unknowns: ["当前名额"],
      },
      {
        name: "示例人物A",
        affiliation: "示例大学",
        homepage: null,
        research_topics: ["程序正确性分析"],
        relation_to_question: "研究程序正确性",
        routes: [
          {
            kind: "undergrad_research",
            description: "欢迎本科生联系",
            status: "explicit",
            quote: "欢迎本科生联系参与科研",
          },
        ],
        evidence: [
          { quote: "研究程序正确性分析与自动验证", supports: "研究方向" },
          {
            quote: "示例人物A是该领域最好的导师",
            supports: "未出现在原文中的评价（用于演示核对）",
          },
        ],
        unknowns: ["当前是否接收", "实际指导方式"],
      },
    ],
  },
  "https://example.org/news-b": {
    relevant: true,
    relevance_reason: "新闻提到同名人物（合成）",
    candidates: [
      {
        name: "王翔",
        affiliation: null,
        homepage: null,
        research_topics: ["大模型知识编辑"],
        relation_to_question: "同名人物，页面未写单位",
        routes: [],
        evidence: [{ quote: "介绍了大模型知识编辑方面的工作", supports: "研究方向" }],
        unknowns: ["身份是否为同一人"],
      },
    ],
  },
};

const RESULTS: Record<SearchProviderId, string[]> = {
  baidu: ["https://example.org/lab-a", "https://example.org/broken"],
  tavily: ["https://example.org/news-b", "https://example.org/lab-a"],
};

export function createSyntheticSearcher(id: SearchProviderId, scale = 1): Searcher {
  return {
    id,
    async search(query, { signal }) {
      await delay((id === "baidu" ? 900 : 1300) * scale, signal);
      return RESULTS[id].map(
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

export function createSyntheticReader(
  scale = 1,
  now: () => Date = () => new Date(),
): Reader {
  return {
    async read(url, { signal }) {
      await delay(1200 * scale, signal);
      const page = PAGES[url];
      if (!page) throw new Error("目标页面返回 HTTP 502（合成故障）");
      return {
        url,
        finalUrl: url,
        title: page.title,
        content: page.content,
        retrievedAt: now().toISOString(),
        origin: page.cached ? "provider-cache" : "live",
        warnings: page.cached ? ["This is a cached snapshot (synthetic)"] : [],
      } satisfies PageRead;
    },
  };
}

export function createSyntheticExtractor(maxChars: number, scale = 1): Extractor {
  return {
    async extract(_question, page, { signal }) {
      await delay(1500 * scale, signal);
      return parseExtraction(
        JSON.stringify(EXTRACTIONS[page.url] ?? { relevant: false }),
        page,
        maxChars,
      );
    },
  };
}
