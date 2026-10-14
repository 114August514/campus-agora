// Tavily search (docs.tavily.com). Basic depth = 1 credit per call.
import { fetchJson } from "../http.ts";
import type { Searcher } from "../pipeline/discover.ts";
import type { SearchHit } from "../types.ts";

const ENDPOINT = "https://api.tavily.com/search";

interface TavilyResponse {
  results?: {
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
  }[];
}

export function createTavilySearcher(apiKey: string): Searcher {
  return {
    id: "tavily",
    async search(query, { count, signal }) {
      const data = await fetchJson<TavilyResponse>(
        ENDPOINT,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          body: {
            query,
            search_depth: "basic",
            max_results: Math.min(Math.max(count, 1), 20),
            include_published_date: true,
          },
        },
        signal,
      );
      return (data.results ?? [])
        .filter((r) => r.url)
        .map(
          (r, index): SearchHit => ({
            provider: "tavily",
            query,
            rank: index + 1,
            title: r.title ?? "",
            url: r.url as string,
            snippet: r.content ?? "",
            publishedDate: r.published_date,
          }),
        );
    },
  };
}
