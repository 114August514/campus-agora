import { expect, test } from "bun:test";
import { discoverSources } from "../src";

test("default browser fetch retains the Window receiver", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function (this: unknown) {
    if (this !== globalThis) throw new TypeError("Illegal invocation");
    return new Response(JSON.stringify({ sources: [], status: "failed" }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await expect(discoverSources("machine learning")).resolves.toMatchObject({
      status: "failed",
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("discovery sends only the public query as JSON and retains request headers", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const result = await discoverSources("machine learning professor", {
    baseUrl: "http://api.test",
    requestId: () => "discovery-1",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          query: "machine learning professor",
          sources: [],
          status: "failed",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  });
  expect(calls[0]?.url).toBe("http://api.test/api/v1/discoveries");
  expect(calls[0]?.init?.method).toBe("POST");
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
    query: "machine learning professor",
  });
  const headers = new Headers(calls[0]?.init?.headers);
  expect(headers.get("Content-Type")).toBe("application/json");
  expect(headers.get("Accept")).toBe("application/json");
  expect(headers.get("x-request-id")).toBe("discovery-1");
  expect(result.status).toBe("failed");
});

test("discovery exposes service validation errors rather than a successful empty result", async () => {
  await expect(
    discoverSources("", {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            code: "validation_failed",
            message: "请输入查找内容",
            requestId: "error-1",
          }),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          },
        ),
    }),
  ).rejects.toMatchObject({
    code: "validation_failed",
    status: 422,
    requestId: "error-1",
  });
});

// Synthetic transport only: these tests do not establish external discovery.
const progressSnapshot = (query: string, finished: boolean) => ({
  query,
  finished,
  sources: [],
  warnings: [],
  status: "partial",
  provider: "duckduckgo_html",
  scope: "合成测试",
  collectedAt: "2026-10-22T00:00:00Z",
  stopReason: "",
  startedReads: 1,
  completedReads: 0,
  limits: {
    maxSeconds: 30,
    maxSources: 5,
    maxReads: 6,
    maxHttpRequests: 48,
    maxPageBytes: 1000000,
  },
});

test("streaming decodes split UTF-8 snapshots, sends only query, and retains the AbortSignal", async () => {
  const { discoverSourcesProgress } = await import("../src");
  const encoder = new TextEncoder();
  const bytes = encoder.encode(
    `${JSON.stringify(progressSnapshot("机器学习", false))}\n${JSON.stringify(progressSnapshot("机器学习", true))}`,
  );
  const controller = new AbortController();
  const received: boolean[] = [];
  const result = await discoverSourcesProgress(
    "机器学习",
    (s) => received.push(s.finished),
    {
      signal: controller.signal,
      fetchImpl: async (_url, init) => {
        expect(init?.signal).toBe(controller.signal);
        expect(JSON.parse(String(init?.body))).toEqual({ query: "机器学习" });
        expect(new Headers(init?.headers).get("accept")).toBe("application/x-ndjson");
        return new Response(
          new ReadableStream({
            start(stream) {
              for (let i = 0; i < bytes.length; i += 7)
                stream.enqueue(bytes.slice(i, i + 7));
              stream.close();
            },
          }),
          { headers: { "Content-Type": "application/x-ndjson" } },
        );
      },
    },
  );
  expect(received).toEqual([false, true]);
  expect(result.finished).toBe(true);
});

test("an interrupted stream reports failure after delivering its partial snapshot", async () => {
  const { discoverSourcesProgress } = await import("../src");
  const received: unknown[] = [];
  await expect(
    discoverSourcesProgress("query", (s) => received.push(s), {
      fetchImpl: async () =>
        new Response(JSON.stringify(progressSnapshot("query", false)) + "\n", {
          headers: { "content-type": "application/x-ndjson" },
        }),
    }),
  ).rejects.toThrow("未完整结束");
  expect(received).toHaveLength(1);
});

test("aborting during a callback cancels the body and suppresses later buffered snapshots", async () => {
  const { discoverSourcesProgress } = await import("../src");
  const controller = new AbortController();
  let received = 0;
  let cancelled = false;
  await expect(
    discoverSourcesProgress(
      "query",
      () => {
        received++;
        controller.abort();
      },
      {
        signal: controller.signal,
        fetchImpl: async () =>
          new Response(
            new ReadableStream({
              start(stream) {
                stream.enqueue(
                  new TextEncoder().encode(
                    `${JSON.stringify(progressSnapshot("query", false))}\n${JSON.stringify(progressSnapshot("query", true))}\n`,
                  ),
                );
              },
              cancel() {
                cancelled = true;
              },
            }),
            { headers: { "content-type": "application/x-ndjson" } },
          ),
      },
    ),
  ).rejects.toThrow();
  expect(received).toBe(1);
  expect(cancelled).toBe(true);
});
