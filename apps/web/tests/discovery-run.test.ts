import { describe, expect, test } from "bun:test";
import type {
  DiscoveryResponse,
  DiscoveryStreamOptions,
} from "@campus-agora/api-client";
import { createDiscoveryRun } from "../src/lib/discovery-run";

function snapshot(query: string, finished = false): DiscoveryResponse {
  return {
    query,
    finished,
    stopReason: "",
    startedReads: 2,
    completedReads: 1,
    limits: {
      maxSeconds: 30,
      maxSources: 5,
      maxReads: 6,
      maxHttpRequests: 48,
      maxPageBytes: 1_000_000,
    },
    provider: "duckduckgo_html",
    scope: "合成测试数据",
    status: "partial",
    collectedAt: "2026-10-22T00:00:00Z",
    warnings: [],
    sources: [
      {
        url: "https://example.edu/research",
        title: "合成正文",
        institution: "example.edu",
        content: "已取得的正文",
        searchSnippet: "",
        relevanceEvidence: [],
        collectedAt: "2026-10-22T00:00:00Z",
        unknowns: [],
      },
    ],
  };
}

function controlledRun() {
  const calls: Array<{
    query: string;
    progress: (value: DiscoveryResponse) => void;
    signal?: AbortSignal;
    resolve: (value: DiscoveryResponse) => void;
    reject: (error: Error) => void;
  }> = [];
  const run = (
    query: string,
    progress: (value: DiscoveryResponse) => void,
    options: DiscoveryStreamOptions,
  ) =>
    new Promise<DiscoveryResponse>((resolve, reject) =>
      calls.push({ query, progress, signal: options.signal, resolve, reject }),
    );
  return { calls, run };
}

describe("bounded discovery runs", () => {
  test("stop retains delivered sources and ignores a transport that delivers after abort", async () => {
    const transport = controlledRun();
    const run = createDiscoveryRun(() => {}, transport);
    const pending = run.start("first");
    const call = transport.calls[0];
    call.progress(snapshot("first"));
    run.stop();
    expect(call.signal?.aborted).toBe(true);
    call.progress({ ...snapshot("first"), sources: [] });
    call.resolve(snapshot("first", true));
    await pending;
    expect(run.getState().phase).toBe("cancelled");
    expect(run.getState().result?.sources).toHaveLength(1);
  });

  test("an old success or failure cannot replace a newer run", async () => {
    const transport = controlledRun();
    const run = createDiscoveryRun(() => {}, transport);
    const first = run.start("old");
    const second = run.start("new");
    transport.calls[1].progress(snapshot("new"));
    transport.calls[0].progress(snapshot("old"));
    transport.calls[0].reject(new Error("late failure"));
    transport.calls[1].resolve(snapshot("new", true));
    await Promise.all([first, second]);
    expect(transport.calls[0].signal?.aborted).toBe(true);
    expect(run.getState()).toMatchObject({
      query: "new",
      phase: "complete",
      error: "",
      result: { query: "new" },
    });
  });

  test("the wait deadline aborts without retrying and preserves partial evidence", async () => {
    const transport = controlledRun();
    const run = createDiscoveryRun(() => {}, { run: transport.run, maxWaitMs: 5 });
    const pending = run.start("bounded");
    transport.calls[0].progress(snapshot("bounded"));
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(run.getState().phase).toBe("limit_reached");
    expect(run.getState().result?.sources).toHaveLength(1);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0].signal?.aborted).toBe(true);
    transport.calls[0].resolve(snapshot("bounded", true));
    await pending;
  });

  test("disposing a topic's run aborts and suppresses all later UI callbacks", async () => {
    const transport = controlledRun();
    let updates = 0;
    const run = createDiscoveryRun(() => updates++, transport);
    const pending = run.start("topic A");
    const before = updates;
    run.dispose();
    transport.calls[0].progress(snapshot("topic A"));
    transport.calls[0].resolve(snapshot("topic A", true));
    await pending;
    expect(updates).toBe(before);
    expect(transport.calls[0].signal?.aborted).toBe(true);
  });

  test("a failed connection preserves the last snapshot and permits an explicit retry", async () => {
    const transport = controlledRun();
    const run = createDiscoveryRun(() => {}, transport);
    const pending = run.start("research");
    transport.calls[0].progress(snapshot("research"));
    transport.calls[0].reject(new Error("connection interrupted"));
    await pending;
    expect(run.getState()).toMatchObject({
      phase: "failed",
      result: { sources: [{ content: "已取得的正文" }] },
    });
    const retry = run.start("research");
    transport.calls[1].resolve({
      ...snapshot("research", true),
      stopReason: "source_limit",
    });
    await retry;
    expect(run.getState().phase).toBe("limit_reached");
    expect(transport.calls).toHaveLength(2);
  });
});
