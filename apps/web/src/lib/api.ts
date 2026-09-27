import { createCampusAgoraApiClient } from "@campus-agora/api-client";
import { getSessionToken } from "../features/auth/session";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080";

export const apiClient = createCampusAgoraApiClient({
  baseUrl,
  authToken: getSessionToken,
});
