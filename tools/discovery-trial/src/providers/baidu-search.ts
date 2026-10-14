// Baidu Qianfan web_search. Request shape follows Baidu's own skill script
// (github.com/baidubce/skills, skills/baidu-search/scripts/search.py).
import { fetchJson } from "../http.ts";
import type { Searcher } from "../pipeline/discover.ts";
import type { SearchHit } from "../types.ts";

const ENDPOINT = "https://qianfan.baidubce.com/v2/ai_search/web_search";

interface BaiduReference {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
  date?: string;
}

interface BaiduResponse {
  code?: string | number;
  message?: string;
  references?: BaiduReference[];
}

export function createBaiduSearcher(apiKey: string): Searcher {
  return {
    id: "baidu",
    async search(query, { count, signal }) {
      const data = await fetchJson<BaiduResponse>(
        ENDPOINT,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          body: {
            messages: [{ role: "user", content: query }],
            search_source: "baidu_search_v2",
            resource_type_filter: [
              { type: "web", top_k: Math.min(Math.max(count, 1), 50) },
            ],
          },
        },
        signal,
      );
      if (data.code !== undefined)
        throw new Error(`百度搜索错误 ${data.code}: ${data.message ?? ""}`);
      return (data.references ?? [])
        .filter((ref) => ref.url)
        .map(
          (ref, index): SearchHit => ({
            provider: "baidu",
            query,
            rank: index + 1,
            title: ref.title ?? "",
            url: ref.url as string,
            snippet: ref.snippet ?? ref.content ?? "",
            publishedDate: ref.date,
          }),
        );
    },
  };
}
