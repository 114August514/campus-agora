// OpenAI-compatible chat completions (default: Zhipu GLM-4.7-Flash). Swapping to a
// paid fallback is a config change only (LLM_BASE_URL / LLM_MODEL / LLM_API_KEY).
import type { LlmConfig } from "../config.ts";
import { fetchJson } from "../http.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface ChatResult {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
}

export async function chatJson(
  config: LlmConfig,
  apiKey: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  maxTokens = 4096,
): Promise<ChatResult> {
  const data = await fetchJson<ChatResponse>(
    `${config.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      body: {
        model: config.model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: maxTokens,
        ...config.extraBody,
      },
    },
    signal,
  );
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "sensitive") throw new Error("模型因内容审核拒绝输出");
  if (choice?.finish_reason === "length")
    throw new Error("模型输出被截断（max_tokens 不足）");
  const content = choice?.message?.content;
  if (!content) throw new Error("模型未返回内容");
  return {
    content,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  };
}
