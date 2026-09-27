import type { LoginResponse, MockLoginRequest, SessionResponse } from "./generated";
import { requestJson } from "./request";
import type { RequestOptions } from "./request";

export type MockPersona = MockLoginRequest["persona"];

export function mockLogin(
  options: RequestOptions,
  persona: MockPersona,
): Promise<LoginResponse> {
  const body: MockLoginRequest = { persona };

  return requestJson<LoginResponse>(options, "/api/v1/auth/mock-login", {
    method: "POST",
    body,
  });
}

export function getAuthSession(options: RequestOptions): Promise<SessionResponse> {
  return requestJson<SessionResponse>(options, "/api/v1/auth/session");
}

export async function logout(options: RequestOptions): Promise<void> {
  await requestJson<undefined>(options, "/api/v1/auth/logout", {
    method: "POST",
  });
}
