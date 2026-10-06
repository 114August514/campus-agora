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
