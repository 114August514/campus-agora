// Relevance judgment and structured extraction from one page. The model only sees the
// user's question and public page text; no topic records or private reasons.
import type { LlmConfig } from "../config.ts";
import { type ChatMessage, chatJson } from "../providers/llm-chat.ts";
import type {
  Evidence,
  ExtractedCandidate,
  ExtractionResult,
  PageRead,
  Route,
  RouteKind,
  RouteStatus,
} from "../types.ts";
import type { Extractor } from "./discover.ts";
import { quoteInText } from "./normalize.ts";

export const EXTRACTION_SYSTEM_PROMPT = `你是导师信息整理助手。根据用户问题和一个网页的正文，判断网页是否相关，并提取其中具体的导师／课题组信息。

规则：
- 只使用网页正文中的信息，不使用你的已有知识，不猜测。
- 每条 quote 必须是网页正文的逐字摘录（可截取一段连续文字），不要改写或翻译。
- 不推断名额、录取概率、指导质量或人品；正文没写就放进 unknowns。
- 历史招生或长期欢迎文字不等于当前开放；按原文描述，并在 unknowns 中注明当前状态待核。
- 院系或项目的招生入口不等于该导师本人接收学生：本人明确说明用 explicit，只有院系／项目入口用 institutional，不清楚用 unconfirmed。
- 网页没有提到具体人物时 candidates 为空数组。

只输出一个 JSON 对象，格式：
{
  "relevant": true,
  "relevance_reason": "网页与问题的关系，一句话",
  "candidates": [
    {
      "name": "姓名（按正文写法）",
      "affiliation": "单位，正文未写则为 null",
      "homepage": "正文中给出的个人主页链接，没有则为 null",
      "research_topics": ["具体研究问题或方向"],
      "relation_to_question": "此人与用户问题的具体联系",
      "routes": [
        {
          "kind": "undergrad_research | graduate_application | short_visit | other",
          "description": "途径说明",
          "status": "explicit | institutional | unconfirmed",
          "quote": "支持该途径的原文"
        }
      ],
      "evidence": [{ "quote": "原文逐字摘录", "supports": "这段原文支持什么" }],
      "unknowns": ["仍未知、需要进一步了解的事项"]
    }
  ]
}`;

export function buildExtractionMessages(
  question: string,
  page: PageRead,
  maxChars: number,
): ChatMessage[] {
  const body = page.content.slice(0, maxChars);
  const truncated = page.content.length > maxChars ? "\n\n[正文过长，已截断]" : "";
  return [
    { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `用户问题：${question}\n\n网页标题：${page.title}\n网页地址：${page.finalUrl}\n\n网页正文：\n${body}${truncated}`,
    },
  ];
}

const ROUTE_KINDS: RouteKind[] = [
  "undergrad_research",
  "graduate_application",
  "short_visit",
  "other",
];
const ROUTE_STATUSES: RouteStatus[] = ["explicit", "institutional", "unconfirmed"];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s ? s : null;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

function objList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    : [];
}

function toEvidence(
  quote: string,
  supports: string,
  page: PageRead,
  text: string,
): Evidence {
  return {
    sourceUrl: page.finalUrl,
    quote,
    supports,
    retrievedAt: page.retrievedAt,
    origin: page.origin,
    quoteVerified: quoteInText(quote, text),
  };
}

/** Parse model JSON defensively and verify every quote against the text actually sent. */
export function parseExtraction(
  raw: string,
  page: PageRead,
  maxChars: number,
): ExtractionResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error(`模型输出不是合法 JSON: ${cleaned.slice(0, 120)}`);
  }
  const sentText = page.content.slice(0, maxChars);

  const candidates = objList(data.candidates)
    .map((c): ExtractedCandidate => {
      const routes = objList(c.routes).map((r): Route => {
        const kind = str(r.kind) as RouteKind;
        const status = str(r.status) as RouteStatus;
        const quote = str(r.quote);
        return {
          kind: ROUTE_KINDS.includes(kind) ? kind : "other",
          description: str(r.description),
          status: ROUTE_STATUSES.includes(status) ? status : "unconfirmed",
          evidence: quote
            ? [toEvidence(quote, str(r.description), page, sentText)]
            : [],
        };
      });
      return {
        name: str(c.name),
        affiliation: strOrNull(c.affiliation),
        homepage: strOrNull(c.homepage),
        researchTopics: strList(c.research_topics),
        relationToQuestion: str(c.relation_to_question),
        routes,
        evidence: objList(c.evidence)
          .filter((e) => str(e.quote))
          .map((e) => toEvidence(str(e.quote), str(e.supports), page, sentText)),
        unknowns: strList(c.unknowns),
      };
    })
    .filter((c) => c.name);

  return {
    sourceUrl: page.finalUrl,
    relevant: data.relevant === true,
    relevanceReason: str(data.relevance_reason),
    candidates,
  };
}

export function createLlmExtractor(
  config: LlmConfig,
  apiKey: string,
  maxChars: number,
): Extractor {
  return {
    async extract(question, page, { signal }) {
      const result = await chatJson(
        config,
        apiKey,
        buildExtractionMessages(question, page, maxChars),
        signal,
      );
      return parseExtraction(result.content, page, maxChars);
    },
  };
}
