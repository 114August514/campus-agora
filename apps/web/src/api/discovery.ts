// Client for the local discovery API (tools/discovery-trial/src/server.ts).
// Shapes mirror the server's RunSnapshot; keep them in sync when either side changes.

export type ServiceMode = "live" | "synthetic";
export type RunStatus =
  | "running"
  | "completed"
  | "cancelled"
  | "limit-reached"
  | "failed";
export type EventState = "running" | "ok" | "failed" | "skipped";

export interface DiscoveryConfig {
  mode: ServiceMode;
  ready: boolean;
  missing: string[];
  searchers: string[];
  recipients: { name: string; receives: string }[];
  llmModel: string;
  limits: {
    maxSearchCalls: number;
    maxReads: number;
    maxLlmCalls: number;
    runTimeoutMs: number;
  };
}

export interface Evidence {
  sourceUrl: string;
  quote: string;
  supports: string;
  retrievedAt: string;
  origin: "live" | "provider-cache";
  quoteVerified: boolean;
}

export interface FoundRoute {
  kind: "undergrad_research" | "graduate_application" | "short_visit" | "other";
  description: string;
  status: "explicit" | "institutional" | "unconfirmed";
  evidence: Evidence[];
}

export interface FoundCandidate {
  name: string;
  affiliation: string | null;
  homepage: string | null;
  researchTopics: string[];
  relationToQuestion: string;
  routes: FoundRoute[];
  evidence: Evidence[];
  unknowns: string[];
}

export type Outcome =
  | {
      kind: "matched";
      specimenId: string;
      candidate: FoundCandidate;
      newSourceUrls: string[];
    }
  | { kind: "new"; candidate: FoundCandidate }
  | {
      kind: "needs-review";
      candidate: FoundCandidate;
      reason: string;
      possibleSpecimenIds: string[];
    };

export interface RunEvent {
  id: string;
  stage: "search" | "read" | "extract";
  provider: string;
  target: string;
  state: EventState;
  detail?: string;
  at: string;
}

export interface RunSnapshot {
  runId: string;
  mode: ServiceMode;
  question: string;
  status: RunStatus;
  stopDetail?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  usage: { search: number; read: number; llm: number };
  events: RunEvent[];
  outcomes: Outcome[];
  failures: { stage: string; provider: string; target: string; message: string }[];
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/discovery${path}`, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError(0, "连不上补查服务");
  }
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // The dev proxy returns a non-JSON error page when the API is not running.
    throw new ApiError(response.status || 0, "连不上补查服务");
  }
  if (!response.ok) {
    const serverMessage = (data as { error?: string }).error;
    // No API error body on a 5xx means the dev proxy could not reach the API.
    if (!serverMessage && response.status >= 500)
      throw new ApiError(0, "连不上补查服务");
    throw new ApiError(
      response.status,
      serverMessage ?? `请求失败（${response.status}）`,
    );
  }
  return data as T;
}

export const discoveryApi = {
  config: () => request<DiscoveryConfig>("/config"),
  start: (question: string) =>
    request<RunSnapshot>("/runs", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
  get: (runId: string) => request<RunSnapshot>(`/runs/${encodeURIComponent(runId)}`),
  cancel: (runId: string) =>
    request<RunSnapshot>(`/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
    }),
};
