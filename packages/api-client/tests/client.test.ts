import { describe, expect, test } from "bun:test";
import {
  CampusAgoraApiError,
  createCampusAgoraApiClient,
  createCampusAgoraMockFetch,
  requestJson,
} from "../src";

function jsonResponse(
  body: unknown,
  init: ResponseInit & { requestId?: string } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");

  if (init.requestId) {
    headers.set("x-request-id", init.requestId);
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

describe("requestJson", () => {
  test("sends accept and request id headers", async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];

    const result = await requestJson<{ ok: true }>(
      {
        baseUrl: "http://api.test",
        fetchImpl: async (url, init) => {
          calls.push({
            url: String(url),
            headers: new Headers(init?.headers),
          });

          return jsonResponse({ ok: true }, { status: 200 });
        },
        requestId: () => "req-1",
      },
      "/api/v1/example",
    );

    expect(result).toEqual({ ok: true });
    expect(calls[0]?.url).toBe("http://api.test/api/v1/example");
    expect(calls[0]?.headers.get("accept")).toBe("application/json");
    expect(calls[0]?.headers.get("x-request-id")).toBe("req-1");
  });

  test.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [422, "validation_failed"],
    [429, "rate_limited"],
  ])("normalizes %i JSON error responses", async (status, code) => {
    expect.assertions(6);

    try {
      await requestJson(
        {
          baseUrl: "http://api.test",
          fetchImpl: async () =>
            jsonResponse(
              {
                code,
                message: "Request failed",
                requestId: "req-from-body",
                details: {
                  field: "title",
                },
              },
              { status, requestId: "req-from-header" },
            ),
        },
        "/api/v1/example",
      );
    } catch (error) {
      expect(error).toBeInstanceOf(CampusAgoraApiError);
      expect((error as CampusAgoraApiError).status).toBe(status);
      expect((error as CampusAgoraApiError).code).toBe(code);
      expect((error as CampusAgoraApiError).message).toBe("Request failed");
      expect((error as CampusAgoraApiError).requestId).toBe("req-from-header");
      expect((error as CampusAgoraApiError).details).toEqual({ field: "title" });
    }
  });

  test("uses body request id when the response header is missing", async () => {
    await expect(
      requestJson(
        {
          baseUrl: "http://api.test",
          fetchImpl: async () =>
            jsonResponse(
              {
                code: "not_found",
                message: "Route not found",
                requestId: "req-from-body",
              },
              { status: 404 },
            ),
        },
        "/api/v1/example",
      ),
    ).rejects.toMatchObject({
      code: "not_found",
      requestId: "req-from-body",
    });
  });

  test("keeps compatibility with legacy nested error responses", async () => {
    await expect(
      requestJson(
        {
          baseUrl: "http://api.test",
          fetchImpl: async () =>
            jsonResponse(
              {
                error: {
                  code: "conflict",
                  message: "Legacy conflict",
                  requestId: "req-from-body",
                },
              },
              { status: 409 },
            ),
        },
        "/api/v1/example",
      ),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "Legacy conflict",
      requestId: "req-from-body",
    });
  });

  test("normalizes network failures", async () => {
    await expect(
      requestJson(
        {
          baseUrl: "http://api.test",
          fetchImpl: async () => {
            throw new TypeError("failed to fetch");
          },
        },
        "/api/v1/example",
      ),
    ).rejects.toMatchObject({
      code: "network_error",
      status: 0,
    });
  });
});

describe("createCampusAgoraMockFetch", () => {
  test("serves typed health, readiness, and meta responses", async () => {
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl: createCampusAgoraMockFetch(),
    });

    await expect(client.getHealth()).resolves.toBe("ok");
    await expect(client.getReady()).resolves.toEqual({
      status: "ready",
      checks: {
        postgres: "ok",
      },
    });
    await expect(client.getMeta()).resolves.toMatchObject({
      appName: "Campus Agora",
      capabilities: {
        authMockEnabled: true,
        desktopEnabled: true,
        aiArchiveEnabled: false,
        attachmentsEnabled: false,
      },
    });
  });
});

describe("auth requests", () => {
  test("requestJson sends bearer tokens and JSON bodies", async () => {
    const calls: Array<{ headers: Headers; body: unknown; method?: string }> = [];

    await requestJson(
      {
        baseUrl: "http://api.test",
        fetchImpl: async (url, init) => {
          calls.push({
            headers: new Headers(init?.headers),
            body: init?.body ? JSON.parse(String(init.body)) : undefined,
            method: init?.method,
          });

          return jsonResponse({ ok: true }, { status: 200 });
        },
        authToken: () => "session-token-1",
      },
      "/api/v1/example",
      { method: "POST", body: { persona: "student" } },
    );

    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer session-token-1");
    expect(calls[0]?.headers.get("content-type")).toBe("application/json");
    expect(calls[0]?.body).toEqual({ persona: "student" });
  });

  test("requestJson resolves empty 204 responses", async () => {
    const result = await requestJson<undefined>(
      {
        baseUrl: "http://api.test",
        fetchImpl: async () => new Response(null, { status: 204 }),
      },
      "/api/v1/auth/logout",
      { method: "POST" },
    );

    expect(result).toBeUndefined();
  });

  test("mock login, session, and logout round-trip through the mock fetch", async () => {
    let token: string | undefined;
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl: createCampusAgoraMockFetch(),
      authToken: () => token,
    });

    const login = await client.mockLogin("organization_member");
    expect(login.token.length).toBeGreaterThan(0);
    expect(login.user.systemRole).toBe("organization_member");
    expect(login.user.organizations[0]?.slug).toBe("demo-student-union");

    token = login.token;

    const session = await client.getAuthSession();
    expect(session.user.id).toBe(login.user.id);
    expect(session.expiresAt).toBe(login.expiresAt);

    await client.logout();
    token = login.token;

    await expect(client.getAuthSession()).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });
  });

  test("session requests without a token normalize to unauthorized", async () => {
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl: createCampusAgoraMockFetch(),
    });

    await expect(client.getAuthSession()).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });
  });
});

// The mock exists so frontend work can proceed without a running backend. Any
// place it disagrees with the real server is a trap: the app tests green and
// then fails in production. These tests pin the divergences that matter,
// mirroring the assertions in crates/api/tests/auth.rs.
describe("mock fetch matches the real server contract", () => {
  const mockFetch = (options?: Parameters<typeof createCampusAgoraMockFetch>[0]) =>
    createCampusAgoraMockFetch(options);

  async function post(
    fetchImpl: typeof fetch,
    path: string,
    body?: string,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    return fetchImpl(`http://api.test${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    });
  }

  test("returns 403 auth_mock_disabled when the capability flag is off", async () => {
    const fetchImpl = mockFetch({
      meta: {
        capabilities: {
          authMockEnabled: false,
          desktopEnabled: true,
          aiArchiveEnabled: false,
          attachmentsEnabled: false,
        },
      },
    });

    const response = await post(
      fetchImpl,
      "/api/v1/auth/mock-login",
      JSON.stringify({ persona: "student" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "auth_mock_disabled",
    });
  });

  test("malformed bodies are 400 invalid_request_body, not 422", async () => {
    const fetchImpl = mockFetch();

    for (const body of ["{not json", "{}", JSON.stringify({ persona: 5 })]) {
      const response = await post(fetchImpl, "/api/v1/auth/mock-login", body);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: "invalid_request_body",
      });
    }
  });

  test("an unknown persona string is 422 validation_failed", async () => {
    const response = await post(
      mockFetch(),
      "/api/v1/auth/mock-login",
      JSON.stringify({ persona: "professor" }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "validation_failed",
    });
  });

  test("prototype keys are not accepted as personas", async () => {
    const response = await post(
      mockFetch(),
      "/api/v1/auth/mock-login",
      JSON.stringify({ persona: "constructor" }),
    );

    expect(response.status).toBe(422);
  });

  test("wrong methods return 405 with an allow header", async () => {
    const fetchImpl = mockFetch();

    const logoutViaGet = await fetchImpl("http://api.test/api/v1/auth/logout");
    expect(logoutViaGet.status).toBe(405);
    expect(logoutViaGet.headers.get("allow")).toBe("POST");

    const sessionViaPost = await post(fetchImpl, "/api/v1/auth/session");
    expect(sessionViaPost.status).toBe(405);
    expect(sessionViaPost.headers.get("allow")).toBe("GET");
  });

  test("readiness failures surface as 503, matching the server", async () => {
    const fetchImpl = mockFetch({
      readiness: { status: "unready", checks: { postgres: "unavailable" } },
    });

    const response = await fetchImpl("http://api.test/readyz");
    expect(response.status).toBe(503);
  });

  test("ids are UUIDs and the session expiry is in the future", async () => {
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl: mockFetch(),
    });

    const login = await client.mockLogin("organization_member");
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    expect(login.user.id).toMatch(uuid);
    expect(login.user.organizations[0]?.organizationId).toMatch(uuid);
    expect(new Date(login.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
