// Shared data shapes for the discovery trial. Public objects only: this trial never
// handles topic records or private reasons (see docs/product/privacy.md).

export type SearchProviderId = "baidu" | "tavily";

export interface SearchHit {
  provider: SearchProviderId;
  query: string;
  rank: number;
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

/** "live" = fetched in this run; "provider-cache" = reader reported a cached snapshot. */
export type ReadOrigin = "live" | "provider-cache";

export interface PageRead {
  url: string;
  finalUrl: string;
  title: string;
  content: string;
  publishedTime?: string;
  retrievedAt: string;
  origin: ReadOrigin;
  warnings: string[];
  tokens?: number;
}

export interface Evidence {
  sourceUrl: string;
  quote: string;
  supports: string;
  retrievedAt: string;
  origin: ReadOrigin;
  /** Quote found verbatim (whitespace-insensitive) in the page text that was read. */
  quoteVerified: boolean;
}

export type RouteKind =
  | "undergrad_research"
  | "graduate_application"
  | "short_visit"
  | "other";

/** explicit = the person states it; institutional = only a program/department entry; unconfirmed = unclear. */
export type RouteStatus = "explicit" | "institutional" | "unconfirmed";

export interface Route {
  kind: RouteKind;
  description: string;
  status: RouteStatus;
  evidence: Evidence[];
}

export interface ExtractedCandidate {
  name: string;
  affiliation: string | null;
  homepage: string | null;
  researchTopics: string[];
  relationToQuestion: string;
  routes: Route[];
  evidence: Evidence[];
  unknowns: string[];
}

export interface ExtractionResult {
  sourceUrl: string;
  relevant: boolean;
  relevanceReason: string;
  candidates: ExtractedCandidate[];
}

/** Existing public object from fixed demo data (not discovered in this run). */
export interface PublicCandidate {
  id: string;
  names: string[];
  affiliations: string[];
  urls: string[];
  researchTopics: string[];
}

export type MergeOutcome =
  | {
      kind: "matched";
      specimenId: string;
      candidate: ExtractedCandidate;
      newSourceUrls: string[];
    }
  | { kind: "new"; candidate: ExtractedCandidate }
  | {
      kind: "needs-review";
      candidate: ExtractedCandidate;
      reason: string;
      possibleSpecimenIds: string[];
    };

export type RunStage = "search" | "read" | "extract";

export interface RunFailure {
  stage: RunStage;
  target: string;
  provider: string;
  message: string;
  at: string;
}

export type RunEventState = "running" | "ok" | "failed" | "skipped";

/** One step of a run, for live progress. `id` is stable across state updates. */
export interface RunEvent {
  id: string;
  stage: RunStage;
  provider: string;
  target: string;
  state: RunEventState;
  detail?: string;
  at: string;
}

export interface RunLimits {
  maxSearchCalls: number;
  maxResultsPerSearch: number;
  maxReads: number;
  maxLlmCalls: number;
  runTimeoutMs: number;
  requestTimeoutMs: number;
  maxCharsPerPage: number;
}

export interface RunUsage {
  search: number;
  read: number;
  llm: number;
}

export type RunStatus = "completed" | "cancelled" | "limit-reached";

export interface RunRecord {
  runId: string;
  question: string;
  queries: string[];
  startedAt: string;
  finishedAt: string;
  status: RunStatus;
  stopDetail?: string;
  limits: RunLimits;
  usage: RunUsage;
  hits: SearchHit[];
  reads: Omit<PageRead, "content">[];
  extractions: ExtractionResult[];
  outcomes: MergeOutcome[];
  failures: RunFailure[];
}
