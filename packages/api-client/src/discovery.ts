import type { DiscoveryRequest, DiscoveryResponse } from "./generated";
import type { CampusAgoraApiClientOptions } from "./meta";
import { requestJson, requestResponse } from "./request";

export function discoverSources(
  query: string,
  options: CampusAgoraApiClientOptions = {},
): Promise<DiscoveryResponse> {
  return requestJson<DiscoveryResponse>(
    {
      baseUrl: options.baseUrl ?? "",
      fetchImpl: options.fetchImpl ?? globalThis.fetch.bind(globalThis),
      requestId: options.requestId,
    },
    "/api/v1/discoveries",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query } satisfies DiscoveryRequest),
    },
  );
}

export interface DiscoveryStreamOptions extends CampusAgoraApiClientOptions {
  signal?: AbortSignal;
}

/** Cumulative snapshots; only finished=true establishes a completed run. */
export async function discoverSourcesProgress(
  query: string,
  onProgress: (result: DiscoveryResponse) => void,
  options: DiscoveryStreamOptions = {},
): Promise<DiscoveryResponse> {
  const response = await requestResponse(
    {
      baseUrl: options.baseUrl ?? "",
      fetchImpl: options.fetchImpl ?? globalThis.fetch.bind(globalThis),
      requestId: options.requestId,
    },
    "/api/v1/discoveries",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({ query } satisfies DiscoveryRequest),
      signal: options.signal,
    },
  );
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("application/x-ndjson")
  ) {
    throw new Error("服务未返回逐条读取结果，请稍后重试。已有资料仍可查看。");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: DiscoveryResponse | undefined;
  const accept = (line: string) => {
    if (!line.trim()) return;
    options.signal?.throwIfAborted();
    const value: DiscoveryResponse = JSON.parse(line);
    if (
      value.query !== query.trim() ||
      typeof value.finished !== "boolean" ||
      !Array.isArray(value.sources) ||
      !Array.isArray(value.warnings)
    ) {
      throw new Error("本次查找返回内容不完整；已取得的资料保留。");
    }
    if (final) throw new Error("查找结束后收到额外内容；请重新查找。");
    onProgress(value);
    if (value.finished) final = value;
  };
  try {
    while (true) {
      options.signal?.throwIfAborted();
      const { done, value } = await reader.read();
      options.signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 1_000_000) throw new Error("本次返回内容超过读取上限。");
      let end = buffer.indexOf("\n");
      while (end >= 0) {
        accept(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        end = buffer.indexOf("\n");
      }
      if (done) break;
    }
    accept(buffer);
    if (!final)
      throw new Error("连接已中断，本轮未完整结束；已取得的正文保留，可主动重试。");
    return final;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
