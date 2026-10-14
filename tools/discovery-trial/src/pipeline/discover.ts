// One discovery run: search (domestic + overseas) -> read full text -> extract -> merge.
// Failures of a single source are recorded and the run continues; cancellation or a
// declared limit stops new work and keeps everything already obtained.
import { type RunBudget, RunStopped } from "../budget.ts";
import { describeError } from "../http.ts";
import type {
  ExtractionResult,
  PageRead,
  PublicCandidate,
  RunEvent,
  RunEventState,
  RunFailure,
  RunRecord,
  RunStage,
  SearchHit,
  SearchProviderId,
} from "../types.ts";
import { mergeWithSpecimens } from "./merge.ts";
import { normalizeUrl } from "./normalize.ts";

export interface Searcher {
  id: SearchProviderId;
  search(
    query: string,
    opts: { count: number; signal: AbortSignal },
  ): Promise<SearchHit[]>;
}

export interface Reader {
  read(url: string, opts: { signal: AbortSignal }): Promise<PageRead>;
}

export interface Extractor {
  extract(
    question: string,
    page: PageRead,
    opts: { signal: AbortSignal },
  ): Promise<ExtractionResult>;
}

export interface DiscoverDeps {
  searchers: Searcher[];
  reader: Reader;
  extractor: Extractor;
  specimens: PublicCandidate[];
  now?: () => Date;
  /** Live step updates (same `id` is re-emitted as its state changes). */
  onEvent?: (event: RunEvent) => void;
  /** Each successful extraction as soon as it is available. */
  onExtraction?: (extraction: ExtractionResult) => void;
}

/** Interleave providers by rank so both domestic and overseas results get read. */
export function pickUrlsToRead(hits: SearchHit[], max: number): SearchHit[] {
  const byProvider = new Map<string, SearchHit[]>();
  for (const hit of [...hits].sort((a, b) => a.rank - b.rank)) {
    const list = byProvider.get(hit.provider) ?? [];
    list.push(hit);
    byProvider.set(hit.provider, list);
  }
  const queues = [...byProvider.values()];
  const seen = new Set<string>();
  const picked: SearchHit[] = [];
  while (picked.length < max && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      const hit = queue.shift();
      if (!hit) continue;
      const key = normalizeUrl(hit.url);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(hit);
      if (picked.length >= max) break;
    }
  }
  return picked;
}

export async function runDiscovery(
  question: string,
  queries: string[],
  deps: DiscoverDeps,
  budget: RunBudget,
): Promise<RunRecord> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const hits: SearchHit[] = [];
  const reads: PageRead[] = [];
  const extractions: ExtractionResult[] = [];
  const failures: RunFailure[] = [];
  let stop: RunStopped | undefined;
  let seq = 0;

  const step = (stage: RunStage, provider: string, target: string) => {
    const id = `${stage}-${++seq}`;
    const emit = (state: RunEventState, detail?: string) =>
      deps.onEvent?.({
        id,
        stage,
        provider,
        target,
        state,
        detail,
        at: now().toISOString(),
      });
    emit("running");
    return {
      ok: (detail?: string) => emit("ok", detail),
      fail: (error: unknown) => {
        const message = describeError(error);
        failures.push({ stage, target, provider, message, at: now().toISOString() });
        emit("failed", message);
      },
      skip: () => emit("skipped", "已停止"),
    };
  };

  try {
    // 1. Search: every (query, provider) pair in parallel, each one budgeted.
    const tasks = queries.flatMap((query) =>
      deps.searchers.map(async (searcher) => {
        budget.take("search");
        const s = step("search", searcher.id, query);
        try {
          const result = await searcher.search(query, {
            count: budget.limits.maxResultsPerSearch,
            signal: budget.requestSignal(),
          });
          if (budget.stopped) return s.skip(); // late result after stop: discard
          hits.push(...result);
          s.ok(`${result.length} 条结果`);
        } catch (error) {
          if (budget.stopped) return s.skip();
          s.fail(error);
        }
      }),
    );
    for (const outcome of await Promise.allSettled(tasks)) {
      if (outcome.status === "rejected" && outcome.reason instanceof RunStopped)
        throw outcome.reason;
    }
    budget.ensureActive();

    // 2–3. Read and extract page by page so partial results accumulate.
    for (const hit of pickUrlsToRead(hits, budget.limits.maxReads)) {
      budget.take("read");
      const r = step("read", "jina", hit.url);
      let page: PageRead;
      try {
        page = await deps.reader.read(hit.url, { signal: budget.requestSignal() });
      } catch (error) {
        if (budget.stopped) r.skip();
        else r.fail(error);
        budget.ensureActive();
        continue;
      }
      if (budget.stopped) r.skip();
      budget.ensureActive();
      reads.push(page);
      r.ok(
        `${page.content.length} 字 · ${page.origin === "live" ? "本次读取" : "缓存快照"}`,
      );

      budget.take("llm");
      const e = step("extract", "llm", hit.url);
      try {
        const extraction = await deps.extractor.extract(question, page, {
          signal: budget.requestSignal(),
        });
        if (budget.stopped) e.skip();
        budget.ensureActive();
        extractions.push(extraction);
        deps.onExtraction?.(extraction);
        e.ok(
          extraction.relevant
            ? `相关，提到 ${extraction.candidates.length} 位人物`
            : "与问题无关",
        );
      } catch (error) {
        if (error instanceof RunStopped) throw error;
        if (budget.stopped) e.skip();
        else e.fail(error);
        budget.ensureActive();
      }
    }
  } catch (error) {
    if (!(error instanceof RunStopped)) throw error;
    stop = error;
  }

  const outcomes = mergeWithSpecimens(
    extractions.filter((e) => e.relevant).flatMap((e) => e.candidates),
    deps.specimens,
  );

  return {
    runId: startedAt.replace(/[:.]/g, "-"),
    question,
    queries,
    startedAt,
    finishedAt: now().toISOString(),
    status: stop ? stop.reason : "completed",
    stopDetail: stop?.message,
    limits: budget.limits,
    usage: budget.usage,
    hits,
    reads: reads.map(({ content: _content, ...meta }) => meta),
    extractions,
    outcomes,
    failures,
  };
}
