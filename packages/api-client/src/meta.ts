import { getAuthSession, logout, mockLogin } from "./auth";
import type { MockPersona } from "./auth";
import type {
  CapabilityFlags,
  HealthResponse,
  LoginResponse,
  MetaResponse,
  ReadinessResponse,
  SessionResponse,
} from "./generated";
import { requestJson } from "./request";

export interface CampusAgoraApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestId?: () => string;
  /** Returns the current session token; omitted or undefined means guest. */
  authToken?: () => string | undefined;
}

export interface CampusAgoraApiClient {
  getHealth(): Promise<HealthResponse>;
  getReady(): Promise<ReadinessResponse>;
  getMeta(): Promise<MetaResponse>;
  mockLogin(persona: MockPersona): Promise<LoginResponse>;
  getAuthSession(): Promise<SessionResponse>;
  logout(): Promise<void>;
}

export function createCampusAgoraApiClient(
  options: CampusAgoraApiClientOptions = {},
): CampusAgoraApiClient {
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:8080";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const requestOptions = {
    baseUrl,
    fetchImpl,
    requestId: options.requestId,
    authToken: options.authToken,
  };

  return {
    async getHealth() {
      const response = await fetchImpl(`${baseUrl}/healthz`, {
        headers: {
          Accept: "text/plain",
        },
      });

      if (!response.ok) {
        throw new Error(`Campus Agora health check failed with ${response.status}`);
      }

      return (await response.text()) as HealthResponse;
    },

    getReady() {
      return requestJson<ReadinessResponse>(requestOptions, "/readyz");
    },

    getMeta() {
      return requestJson<MetaResponse>(requestOptions, "/api/v1/meta");
    },

    mockLogin(persona) {
      return mockLogin(requestOptions, persona);
    },

    getAuthSession() {
      return getAuthSession(requestOptions);
    },

    logout() {
      return logout(requestOptions);
    },
  };
}

export type { CapabilityFlags, HealthResponse, MetaResponse, ReadinessResponse };
