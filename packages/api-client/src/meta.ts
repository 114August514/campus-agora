import { requestJson } from "./request";
import type {
  CapabilityFlags,
  HealthResponse,
  MetaResponse,
  ReadinessResponse
} from "./generated";

export interface CampusAgoraApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestId?: () => string;
}

export interface CampusAgoraApiClient {
  getHealth(): Promise<HealthResponse>;
  getReady(): Promise<ReadinessResponse>;
  getMeta(): Promise<MetaResponse>;
}

export function createCampusAgoraApiClient(
  options: CampusAgoraApiClientOptions = {}
): CampusAgoraApiClient {
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:8080";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const requestId = options.requestId;

  return {
    async getHealth() {
      const response = await fetchImpl(`${baseUrl}/healthz`, {
        headers: {
          Accept: "text/plain"
        }
      });

      if (!response.ok) {
        throw new Error(`Campus Agora health check failed with ${response.status}`);
      }

      return (await response.text()) as HealthResponse;
    },

    getReady() {
      return requestJson<ReadinessResponse>(
        { baseUrl, fetchImpl, requestId },
        "/readyz"
      );
    },

    getMeta() {
      return requestJson<MetaResponse>(
        { baseUrl, fetchImpl, requestId },
        "/api/v1/meta"
      );
    }
  };
}

export type { CapabilityFlags, HealthResponse, MetaResponse, ReadinessResponse };
