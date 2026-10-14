// Holds discovery runs for the local API: one active run at a time (the free GLM tier
// allows concurrency 1), live snapshots while running, and cancellation that discards
// any result arriving afterwards.
import { RunBudget } from "./budget.ts";
import { type TrialConfig, requireKey } from "./config.ts";
import { describeError } from "./http.ts";
import {
  type Extractor,
  type Reader,
  type Searcher,
  runDiscovery,
} from "./pipeline/discover.ts";
import { createLlmExtractor } from "./pipeline/extract.ts";
import { mergeWithSpecimens } from "./pipeline/merge.ts";
import { createBaiduSearcher } from "./providers/baidu-search.ts";
import { createJinaReader } from "./providers/jina-reader.ts";
import {
  createSyntheticExtractor,
  createSyntheticReader,
  createSyntheticSearcher,
} from "./providers/synthetic.ts";
import { createTavilySearcher } from "./providers/tavily-search.ts";
import { writeRunRecord } from "./run-log.ts";
import type {
  ExtractionResult,
  MergeOutcome,
  PublicCandidate,
  RunEvent,
  RunFailure,
  RunLimits,
  RunStatus,
  RunUsage,
} from "./types.ts";

export type ServiceMode = "live" | "synthetic";

export interface Recipient {
  name: string;
  receives: string;
}

export interface Services {
  mode: ServiceMode;
  searchers: Searcher[];
  reader: Reader | undefined;
  extractor: Extractor | undefined;
  /** Env vars still missing; a run can start only when this blocks nothing essential. */
  missing: string[];
  recipients: Recipient[];
  llmModel: string;
}

export function buildServices(config: TrialConfig, synthetic: boolean): Services {
  if (synthetic) {
    return {
      mode: "synthetic",
      searchers: [createSyntheticSearcher("baidu"), createSyntheticSearcher("tavily")],
      reader: createSyntheticReader(),
      extractor: createSyntheticExtractor(config.limits.maxCharsPerPage),
      missing: [],
      recipients: [],
      llmModel: "synthetic",
    };
  }
  const missing: string[] = [];
  const searchers: Searcher[] = [];
  const recipients: Recipient[] = [];
  if (config.qianfanApiKey) {
    searchers.push(createBaiduSearcher(config.qianfanApiKey));
    recipients.push({ name: "百度千帆搜索", receives: "你输入的问题（用于搜索）" });
  } else missing.push("QIANFAN_API_KEY");
  if (config.tavilyApiKey) {
    searchers.push(createTavilySearcher(config.tavilyApiKey));
    recipients.push({ name: "Tavily 搜索", receives: "你输入的问题（用于搜索）" });
  } else missing.push("TAVILY_API_KEY");
  recipients.push({
    name: "Jina Reader",
    receives: "搜索到的公开网页地址（用于读取正文）",
  });
  let extractor: Extractor | undefined;
  if (config.llm.apiKey) {
    extractor = createLlmExtractor(
      config.llm,
      requireKey("LLM", config.llm.apiKey),
      config.limits.maxCharsPerPage,
    );
    recipients.push({
      name: `模型 ${config.llm.model}`,
      receives: "你输入的问题和公开网页正文（用于判断相关性并整理）",
    });
  } else missing.push("ZHIPU_API_KEY");
  return {
    mode: "live",
    searchers,
    reader: createJinaReader(config.jinaApiKey),
    extractor,
    missing,
    recipients,
    llmModel: config.llm.model,
  };
}

export type SnapshotStatus = "running" | RunStatus | "failed";

export interface RunSnapshot {
  runId: string;
  mode: ServiceMode;
  question: string;
  status: SnapshotStatus;
  stopDetail?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  limits: RunLimits;
  usage: RunUsage;
  events: RunEvent[];
  outcomes: MergeOutcome[];
  failures: RunFailure[];
}

interface RunState {
  snapshot: Omit<RunSnapshot, "events" | "outcomes" | "usage" | "failures">;
  events: Map<string, RunEvent>;
  extractions: ExtractionResult[];
  controller: AbortController;
  budget: RunBudget;
  closed: boolean;
}

export class RunError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RunError";
    this.status = status;
  }
}

const MAX_QUESTION_LENGTH = 300;
const KEEP_RUNS = 20;

export class RunManager {
  private readonly runs = new Map<string, RunState>();
  private readonly services: Services;
  private readonly specimens: PublicCandidate[];
  private readonly limits: RunLimits;
  private readonly outDir: string | undefined;
  private seq = 0;

  constructor(
    services: Services,
    specimens: PublicCandidate[],
    limits: RunLimits,
    outDir?: string,
  ) {
    this.services = services;
    this.specimens = specimens;
    this.limits = limits;
    this.outDir = outDir;
  }

  start(rawQuestion: unknown): RunSnapshot {
    const question = typeof rawQuestion === "string" ? rawQuestion.trim() : "";
    if (!question) throw new RunError(400, "请输入问题或关键词");
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new RunError(400, `问题请控制在 ${MAX_QUESTION_LENGTH} 字以内`);
    }
    const { searchers, reader, extractor } = this.services;
    if (searchers.length === 0 || !reader || !extractor) {
      throw new RunError(
        503,
        `补查服务未配置：缺少 ${this.services.missing.join("、")}`,
      );
    }
    if ([...this.runs.values()].some((r) => !r.closed)) {
      throw new RunError(409, "已有一次补查在进行，请等它结束或先中止");
    }

    const runId = `run-${Date.now()}-${++this.seq}`;
    const controller = new AbortController();
    const budget = new RunBudget(this.limits, controller.signal);
    const state: RunState = {
      snapshot: {
        runId,
        mode: this.services.mode,
        question,
        status: "running",
        startedAt: new Date().toISOString(),
        limits: this.limits,
      },
      events: new Map(),
      extractions: [],
      controller,
      budget,
      closed: false,
    };
    this.runs.set(runId, state);
    this.prune();

    runDiscovery(
      question,
      [question],
      {
        searchers,
        reader,
        extractor,
        specimens: this.specimens,
        // After cancel, late events and results are not written into the run.
        onEvent: (e) => {
          if (!state.closed) state.events.set(e.id, e);
        },
        onExtraction: (x) => {
          if (!state.closed) state.extractions.push(x);
        },
      },
      budget,
    )
      .then(async (record) => {
        if (!state.closed) {
          state.snapshot.status = record.status;
          state.snapshot.stopDetail = record.stopDetail;
          this.close(state);
        }
        if (this.outDir)
          await writeRunRecord(this.outDir, { ...record, runId }).catch(() => {});
      })
      .catch((error: unknown) => {
        if (state.closed) return;
        state.snapshot.status = "failed";
        state.snapshot.error = describeError(error);
        this.close(state);
      });

    return this.snapshot(state);
  }

  get(runId: string): RunSnapshot | undefined {
    const state = this.runs.get(runId);
    return state && this.snapshot(state);
  }

  cancel(runId: string): RunSnapshot | undefined {
    const state = this.runs.get(runId);
    if (!state) return undefined;
    if (!state.closed) {
      state.controller.abort();
      state.snapshot.status = "cancelled";
      state.snapshot.stopDetail = "用户中止了本次查找";
      this.close(state);
    }
    return this.snapshot(state);
  }

  private close(state: RunState): void {
    for (const [id, e] of state.events) {
      if (e.state === "running")
        state.events.set(id, { ...e, state: "skipped", detail: "已停止" });
    }
    state.snapshot.finishedAt = new Date().toISOString();
    state.closed = true;
  }

  private snapshot(state: RunState): RunSnapshot {
    const events = [...state.events.values()];
    return {
      ...state.snapshot,
      usage: state.budget.usage,
      events,
      // Failures recorded before a cancel stay visible; later ones are not written.
      failures: events
        .filter((e) => e.state === "failed")
        .map((e) => ({
          stage: e.stage,
          provider: e.provider,
          target: e.target,
          message: e.detail ?? "",
          at: e.at,
        })),
      outcomes: mergeWithSpecimens(
        state.extractions.filter((x) => x.relevant).flatMap((x) => x.candidates),
        this.specimens,
      ),
    };
  }

  private prune(): void {
    const closed = [...this.runs.values()].filter((r) => r.closed);
    for (const r of closed.slice(0, Math.max(0, this.runs.size - KEEP_RUNS))) {
      this.runs.delete(r.snapshot.runId);
    }
  }
}
