import {
  createCampusAgoraApiClient,
  createCampusAgoraMockFetch,
} from "@campus-agora/api-client";
import { getSessionToken } from "../features/auth/session";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080";

/**
 * Mock mode lets the UI be developed and tested without a running backend.
 * `VITE_API_MOCK` is read from Vite's env in the browser and from the process
 * env under test, which `apps/web/tests/setup.ts` sets, so a component test
 * never depends on a live server.
 */
function shouldUseMock(): boolean {
  if (import.meta.env.VITE_API_MOCK === "true") {
    return true;
  }

  return (
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env?.VITE_API_MOCK === "true"
  );
}

export const apiClient = createCampusAgoraApiClient({
  baseUrl,
  authToken: getSessionToken,
  fetchImpl: shouldUseMock() ? createCampusAgoraMockFetch() : undefined,
});
