import type { DiscoveryRequest, DiscoveryResponse } from "./generated";
import type { CampusAgoraApiClientOptions } from "./meta";
import { requestJson } from "./request";

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
