// Jina Reader (r.jina.ai). Keyless works at a lower rate limit. We ask for a fresh
// fetch and still mark any reported cached snapshot, so cache is never shown as a
// live read from this run.
import { fetchJson } from "../http.ts";
import type { Reader } from "../pipeline/discover.ts";
import type { PageRead } from "../types.ts";

interface JinaResponse {
  code?: number;
  status?: number;
  data?: {
    title?: string;
    url?: string;
    content?: string;
    publishedTime?: string;
    warning?: string;
    httpStatus?: number;
    usage?: { tokens?: number };
  };
}

export function createJinaReader(
  apiKey: string | undefined,
  now: () => Date = () => new Date(),
): Reader {
  return {
    async read(url, { signal }) {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "X-No-Cache": "true",
        "X-Timeout": "30",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const data = await fetchJson<JinaResponse>(
        `https://r.jina.ai/${url}`,
        { headers },
        signal,
      );
      const page = data.data;
      if (!page?.content)
        throw new Error(`Jina 未返回正文（code ${data.code ?? "?"}）`);
      if (page.httpStatus && page.httpStatus >= 400) {
        throw new Error(`目标页面返回 HTTP ${page.httpStatus}`);
      }
      const warnings = page.warning ? page.warning.split("\n").filter(Boolean) : [];
      const cached = warnings.some((w) => /cached snapshot/i.test(w));
      return {
        url,
        finalUrl: page.url ?? url,
        title: page.title ?? "",
        content: page.content,
        publishedTime: page.publishedTime,
        retrievedAt: now().toISOString(),
        origin: cached ? "provider-cache" : "live",
        warnings,
        tokens: page.usage?.tokens,
      } satisfies PageRead;
    },
  };
}
