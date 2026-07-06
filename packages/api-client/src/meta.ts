import { requestJson } from "./request";

export interface CapabilityFlags {
  authMockEnabled: boolean;
  desktopEnabled: boolean;
  aiArchiveEnabled: boolean;
  attachmentsEnabled: boolean;
}

export interface MetaResponse {
  appName: "Campus Agora";
  version: string;
  capabilities: CapabilityFlags;
}

export type HealthResponse = "ok";

export interface CampusAgoraApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface CampusAgoraApiClient {
  getHealth(): Promise<HealthResponse>;
  getMeta(): Promise<MetaResponse>;
}

export function createCampusAgoraApiClient(
  options: CampusAgoraApiClientOptions = {}
): CampusAgoraApiClient {
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:8080";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

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

    getMeta() {
      return requestJson<MetaResponse>(
        { baseUrl, fetchImpl },
        "/api/v1/meta"
      );
    }
  };
}
