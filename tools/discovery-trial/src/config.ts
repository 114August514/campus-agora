import type { RunLimits } from "./types.ts";

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  /** Provider-specific body fields, e.g. Zhipu's `thinking`. */
  extraBody: Record<string, unknown>;
}

export interface TrialConfig {
  qianfanApiKey: string | undefined;
  tavilyApiKey: string | undefined;
  jinaApiKey: string | undefined;
  llm: LlmConfig;
  limits: RunLimits;
  outDir: string;
}

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

// Declared per-run limits (task design v0.3: cancellable discovery with stated caps).
// Starting values for the trial; adjust after measuring latency and failure rates.
export const DEFAULT_LIMITS: RunLimits = {
  maxSearchCalls: 4,
  maxResultsPerSearch: 8,
  maxReads: 6,
  maxLlmCalls: 8,
  runTimeoutMs: 180_000,
  requestTimeoutMs: 45_000,
  maxCharsPerPage: 20_000,
};

function value(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const v = env[name]?.trim();
  return v ? v : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): TrialConfig {
  const baseUrl = value(env, "LLM_BASE_URL") ?? ZHIPU_BASE_URL;
  const isZhipu = baseUrl.startsWith(ZHIPU_BASE_URL);
  return {
    qianfanApiKey: value(env, "QIANFAN_API_KEY"),
    tavilyApiKey: value(env, "TAVILY_API_KEY"),
    jinaApiKey: value(env, "JINA_API_KEY"),
    llm: {
      baseUrl,
      model: value(env, "LLM_MODEL") ?? "glm-4.7-flash",
      apiKey: value(env, "LLM_API_KEY") ?? value(env, "ZHIPU_API_KEY"),
      // Thinking is not needed for extraction and slows the free tier (concurrency 1).
      extraBody: isZhipu ? { thinking: { type: "disabled" } } : {},
    },
    limits: DEFAULT_LIMITS,
    outDir: value(env, "DISCOVERY_OUT_DIR") ?? "out",
  };
}

export function requireKey(name: string, key: string | undefined): string {
  if (!key) throw new Error(`缺少环境变量 ${name}（见 .env.example）`);
  return key;
}
