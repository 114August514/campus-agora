import { describe, expect, test } from "bun:test";
import type { CampusAgoraApiClient } from "../src";
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
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    expect(login.user.id).toMatch(uuid);
    expect(login.user.organizations[0]?.organizationId).toMatch(uuid);
    expect(new Date(login.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

// The archive mock must behave like crates/api, or frontend work builds on
// behavior that does not exist. These mirror crates/api/tests/archive.rs.
describe("knowledge archive client", () => {
  async function authedClient(
    persona: Parameters<CampusAgoraApiClient["mockLogin"]>[0],
  ) {
    const fetchImpl = createCampusAgoraMockFetch();
    // Logging in needs a client, and the client needs the token the login
    // returns, so the holder is filled in immediately after.
    const holder: { token?: string } = {};
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => holder.token,
    });
    const login = await client.mockLogin(persona);
    holder.token = login.token;

    return {
      client,
      user: login.user,
      guest: createCampusAgoraApiClient({ baseUrl: "http://api.test", fetchImpl }),
      as(otherToken: string | undefined) {
        return createCampusAgoraApiClient({
          baseUrl: "http://api.test",
          fetchImpl,
          authToken: () => otherToken,
        });
      },
      fetchImpl,
    };
  }

  const draft = {
    title: "新生报到清单",
    body: "正文内容",
    summary: "摘要",
    tags: ["新生", "报到"],
    category: "onboarding",
    applicableAudience: "new_students",
    sourceKind: "firsthand_experience",
  } as const;

  test("creating an entry returns a draft at revision 1", async () => {
    const { client } = await authedClient("student");

    const entry = await client.createKnowledgeEntry(draft);

    expect(entry.moderationStatus).toBe("draft");
    expect(entry.currentRevision).toBe(1);
    expect(entry.title).toBe("新生报到清单");
    expect(entry.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("creating an entry without a session is unauthorized", async () => {
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl: createCampusAgoraMockFetch(),
    });

    await expect(client.createKnowledgeEntry(draft)).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });
  });

  test("a blank title is 422, not 400", async () => {
    const { client } = await authedClient("student");

    await expect(
      client.createKnowledgeEntry({ ...draft, title: "   " }),
    ).rejects.toMatchObject({ code: "validation_failed", status: 422 });
  });

  test("drafts are hidden from guests and visible to their author", async () => {
    const { client, guest } = await authedClient("student");

    const published = await client.createKnowledgeEntry(draft);
    await client.createKnowledgeEntry({ ...draft, title: "仍是草稿" });
    await client.changeKnowledgeEntryStatus(published.id, "published");

    const guestPage = await guest.listKnowledgeEntries();
    expect(guestPage.totalItems).toBe(1);
    expect(guestPage.items[0]?.title).toBe("新生报到清单");

    const ownerPage = await client.listKnowledgeEntries();
    expect(ownerPage.totalItems).toBe(2);

    await expect(
      guest.getKnowledgeEntry(
        ownerPage.items.find((item) => item.title === "仍是草稿")?.id ?? "",
      ),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  test("an illegal status transition is a conflict", async () => {
    const { client } = await authedClient("admin");

    const entry = await client.createKnowledgeEntry(draft);

    await expect(
      client.changeKnowledgeEntryStatus(entry.id, "hidden"),
    ).rejects.toMatchObject({ code: "conflict", status: 409 });
  });

  test("updating a published entry adds a revision", async () => {
    const { client } = await authedClient("student");

    const entry = await client.createKnowledgeEntry(draft);
    await client.changeKnowledgeEntryStatus(entry.id, "published");
    const updated = await client.updateKnowledgeEntry(entry.id, {
      title: "新生报到清单（2026 版）",
    });

    expect(updated.currentRevision).toBe(2);

    const history = await client.listKnowledgeEntryRevisions(entry.id);
    expect(history.items).toHaveLength(2);
    expect(history.items[0]?.revision).toBe(1);
    expect(history.items[1]?.title).toBe("新生报到清单（2026 版）");
  });

  test("pagination reports totals and rejects an out-of-range page size", async () => {
    const { client, guest } = await authedClient("student");

    for (const title of ["条目一", "条目二", "条目三"]) {
      const entry = await client.createKnowledgeEntry({ ...draft, title });
      await client.changeKnowledgeEntryStatus(entry.id, "published");
    }

    const page = await guest.listKnowledgeEntries({ page: 2, pageSize: 2 });
    expect(page.page).toBe(2);
    expect(page.totalItems).toBe(3);
    expect(page.totalPages).toBe(2);
    expect(page.items).toHaveLength(1);

    await expect(guest.listKnowledgeEntries({ pageSize: 101 })).rejects.toMatchObject({
      code: "validation_failed",
      status: 422,
    });
  });

  test("search-lite filters by query, tag, and category", async () => {
    const { client, guest } = await authedClient("student");

    for (const [title, category] of [
      ["宿舍生活指南", "campus_life"],
      ["新生报到流程", "onboarding"],
    ] as const) {
      const entry = await client.createKnowledgeEntry({ ...draft, title, category });
      await client.changeKnowledgeEntryStatus(entry.id, "published");
    }

    await expect(guest.listKnowledgeEntries({ q: "宿舍" })).resolves.toMatchObject({
      totalItems: 1,
    });
    await expect(
      guest.listKnowledgeEntries({ category: "onboarding" }),
    ).resolves.toMatchObject({ totalItems: 1 });
    await expect(guest.listKnowledgeEntries({ tag: "新生" })).resolves.toMatchObject({
      totalItems: 2,
    });
  });

  test("corrections are filed by readers and resolved by the author", async () => {
    const { client, fetchImpl } = await authedClient("student");

    const entry = await client.createKnowledgeEntry(draft);
    await client.changeKnowledgeEntryStatus(entry.id, "published");

    const reporterHolder: { token?: string } = {};
    const reporter = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => reporterHolder.token,
    });
    reporterHolder.token = (await reporter.mockLogin("organization_member")).token;

    const correction = await reporter.fileKnowledgeEntryCorrection(
      entry.id,
      "报名时间已经变了",
    );
    expect(correction.resolvedAt).toBeUndefined();

    // The reporter has no stake in the entry, so closing it is not theirs.
    await expect(
      reporter.resolveKnowledgeEntryCorrection(entry.id, correction.id),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });

    const resolved = await client.resolveKnowledgeEntryCorrection(
      entry.id,
      correction.id,
    );
    expect(resolved.resolvedAt).toBeTruthy();

    const listed = await client.listKnowledgeEntryCorrections(entry.id);
    expect(listed.items).toHaveLength(1);
  });
});

// The mock is the only thing apps/web tests run against, so any place it is
// more permissive than the server means the frontend is verified against
// behavior that does not exist. These mirror crates/api/tests/archive.rs and
// crates/application/src/archive/service.rs.
describe("archive mock matches the server's rules", () => {
  async function session(persona: Parameters<CampusAgoraApiClient["mockLogin"]>[0]) {
    const fetchImpl = createCampusAgoraMockFetch();
    const holder: { token?: string } = {};
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => holder.token,
    });
    holder.token = (await client.mockLogin(persona)).token;

    return { client, fetchImpl, holder };
  }

  const draft = {
    title: "原标题",
    body: "原正文",
    summary: "原摘要",
    tags: ["原标签"],
    category: "onboarding",
    applicableAudience: "new_students",
    sourceKind: "firsthand_experience",
  } as const;

  test("an unknown bearer token is 401, not a silent downgrade to guest", async () => {
    const fetchImpl = createCampusAgoraMockFetch();
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => "expired-or-bogus",
    });

    // The server comment in crates/api/src/archive.rs is explicit that an
    // expired session must not quietly become a guest and hide the reader's
    // own drafts.
    await expect(client.listKnowledgeEntries()).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });
  });

  test("PATCH applies every field the contract exposes", async () => {
    const { client } = await session("student");
    const entry = await client.createKnowledgeEntry(draft);

    const updated = await client.updateKnowledgeEntry(entry.id, {
      title: "新标题",
      body: "新正文",
      summary: "新摘要",
      tags: ["新标签"],
      category: "academics",
      applicableAudience: "graduate",
      sourceKind: "official_announcement",
      sourceReference: "https://example.test/new",
    });

    expect(updated.title).toBe("新标题");
    expect(updated.summary).toBe("新摘要");
    expect(updated.tags).toEqual(["新标签"]);
    expect(updated.category).toBe("academics");
    expect(updated.applicableAudience).toBe("graduate");
    expect(updated.sourceKind).toBe("official_announcement");
    expect(updated.sourceReference).toBe("https://example.test/new");
  });

  test("only a moderator or admin may move an entry beyond publishing own draft", async () => {
    const { client } = await session("student");
    const entry = await client.createKnowledgeEntry(draft);

    // An author publishing their own draft is allowed...
    await client.changeKnowledgeEntryStatus(entry.id, "published");

    // ...but hiding is a moderation action.
    await expect(
      client.changeKnowledgeEntryStatus(entry.id, "hidden"),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  test("an author may not reject their own draft", async () => {
    const { client } = await session("student");
    const entry = await client.createKnowledgeEntry(draft);

    await expect(
      client.changeKnowledgeEntryStatus(entry.id, "rejected"),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  test("a non-author organization member cannot edit someone else's entry", async () => {
    const { client, fetchImpl } = await session("student");
    const entry = await client.createKnowledgeEntry(draft);
    await client.changeKnowledgeEntryStatus(entry.id, "published");

    const otherHolder: { token?: string } = {};
    const other = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => otherHolder.token,
    });
    otherHolder.token = (await other.mockLogin("organization_member")).token;

    await expect(
      other.updateKnowledgeEntry(entry.id, { title: "劫持" }),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  test("input the server rejects is rejected here too", async () => {
    const { client } = await session("student");

    // Unknown enum value: 400 on the server.
    await expect(
      client.createKnowledgeEntry({
        ...draft,
        category: "not_a_category" as never,
      }),
    ).rejects.toMatchObject({ code: "invalid_request_body", status: 400 });

    // Too many tags: 422 on the server (MAX_TAGS = 10).
    await expect(
      client.createKnowledgeEntry({
        ...draft,
        tags: Array.from({ length: 11 }, (_, index) => `tag${index}`),
      }),
    ).rejects.toMatchObject({ code: "validation_failed", status: 422 });

    // Blank body: 422 on the server.
    await expect(
      client.createKnowledgeEntry({ ...draft, body: "   " }),
    ).rejects.toMatchObject({ code: "validation_failed", status: 422 });
  });

  test("correction listing requires a stake in the entry", async () => {
    const { client, fetchImpl } = await session("student");
    const entry = await client.createKnowledgeEntry(draft);
    await client.changeKnowledgeEntryStatus(entry.id, "published");

    const guest = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
    });

    // privacy.md restricts reporter identities to the author, maintainers,
    // moderators, and admins.
    await expect(guest.listKnowledgeEntryCorrections(entry.id)).rejects.toMatchObject({
      status: 401,
    });
  });

  test("a correction cannot be resolved through an unrelated entry", async () => {
    const { client, fetchImpl } = await session("student");
    const victim = await client.createKnowledgeEntry(draft);
    await client.changeKnowledgeEntryStatus(victim.id, "published");

    const attackerHolder: { token?: string } = {};
    const attacker = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => attackerHolder.token,
    });
    attackerHolder.token = (await attacker.mockLogin("organization_member")).token;

    const correction = await attacker.fileKnowledgeEntryCorrection(
      victim.id,
      "内容已过期",
    );
    const own = await attacker.createKnowledgeEntry({ ...draft, title: "攻击者条目" });

    await expect(
      attacker.resolveKnowledgeEntryCorrection(own.id, correction.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("discussion client and the loop into the archive", () => {
  async function harness() {
    const fetchImpl = createCampusAgoraMockFetch();
    const holder: { token?: string } = {};
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => holder.token,
    });
    const login = await client.mockLogin("student");
    holder.token = login.token;

    const guest = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
    });

    async function other(persona: "organization_member" | "moderator") {
      const holder2: { token?: string } = {};
      const c = createCampusAgoraApiClient({
        baseUrl: "http://api.test",
        fetchImpl,
        authToken: () => holder2.token,
      });
      const l = await c.mockLogin(persona);
      holder2.token = l.token;
      return { client: c, user: l.user };
    }

    return { client, guest, user: login.user, other };
  }

  async function publishedDiscussion(
    client: CampusAgoraApiClient,
    title = "场地申请流程",
  ) {
    const created = await client.createDiscussion({
      title,
      body: "有人知道流程吗？",
      tags: ["办事流程"],
    });

    return client.changeDiscussionStatus(created.id, "published");
  }

  test("a new discussion is a private draft", async () => {
    const { client, guest } = await harness();

    const created = await client.createDiscussion({
      title: "草稿",
      body: "正文",
      tags: [],
    });

    expect(created.moderationStatus).toBe("draft");
    expect(created.replyCount).toBe(0);
    expect(created.acceptedCommentId ?? null).toBeNull();

    // 404 rather than 403: the mock must not admit a draft exists either.
    await expect(guest.getDiscussion(created.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  test("replies are created, listed oldest first, and counted", async () => {
    const { client } = await harness();
    const discussion = await publishedDiscussion(client);

    const first = await client.replyToDiscussion(discussion.id, "先去团委登记");
    const second = await client.replyToDiscussion(discussion.id, "再去盖章");

    const replies = await client.listDiscussionReplies(discussion.id);
    expect(replies.items.map((item) => item.id)).toEqual([first.id, second.id]);

    const reloaded = await client.getDiscussion(discussion.id);
    expect(reloaded.replyCount).toBe(2);
  });

  test("the accepted answer can be set, replaced, and cleared", async () => {
    const { client } = await harness();
    const discussion = await publishedDiscussion(client);
    const first = await client.replyToDiscussion(discussion.id, "方案一");
    const second = await client.replyToDiscussion(discussion.id, "方案二");

    let updated = await client.acceptDiscussionAnswer(discussion.id, first.id);
    expect(updated.acceptedCommentId).toBe(first.id);

    updated = await client.acceptDiscussionAnswer(discussion.id, second.id);
    expect(updated.acceptedCommentId).toBe(second.id);

    updated = await client.acceptDiscussionAnswer(discussion.id, null);
    expect(updated.acceptedCommentId ?? null).toBeNull();
  });

  test("promoting records the entry and its source in one response", async () => {
    const { client, other } = await harness();
    const discussion = await publishedDiscussion(client);
    const reply = await client.replyToDiscussion(
      discussion.id,
      "先去团委登记，再到场馆办公室盖章。",
    );

    const curator = await other("organization_member");
    const promoted = await curator.client.promoteDiscussion(discussion.id, {
      commentId: reply.id,
      title: "场地申请流程指南",
      category: "procedures",
    });

    expect(promoted.entry.moderationStatus).toBe("draft");
    expect(promoted.entry.title).toBe("场地申请流程指南");
    expect(promoted.entry.body).toBe("先去团委登记，再到场馆办公室盖章。");
    expect(promoted.entry.sourceKind).toBe("discussion");
    // The reply's author, not the promoter: attribution has to survive.
    expect(promoted.source.sourceAuthorId).toBe(reply.authorId);
    expect(promoted.source.sourcePostId).toBe(discussion.id);

    const sources = await curator.client.listKnowledgeEntrySources(promoted.entry.id);
    expect(sources.items[0]?.sourceTitle).toBe("场地申请流程");
  });

  test("derived entries follow the reader's visibility", async () => {
    const { client, guest, other } = await harness();
    const discussion = await publishedDiscussion(client);
    const curator = await other("organization_member");
    const promoted = await curator.client.promoteDiscussion(discussion.id, {});

    expect(
      (await guest.listDiscussionDerivedEntries(discussion.id)).items,
    ).toHaveLength(0);
    expect(
      (await curator.client.listDiscussionDerivedEntries(discussion.id)).items,
    ).toHaveLength(1);

    await curator.client.changeKnowledgeEntryStatus(promoted.entry.id, "published");

    expect(
      (await guest.listDiscussionDerivedEntries(discussion.id)).items,
    ).toHaveLength(1);
  });
});

/// The mock is the only backend the frontend tests ever see. Every rule the
/// server enforces has to be enforced here too, or a page can pass its tests
/// against behaviour the server does not have. M1 and M2 each shipped a
/// divergence of exactly this kind.
describe("discussion mock matches the server's rules", () => {
  async function harness() {
    const fetchImpl = createCampusAgoraMockFetch();
    const holder: { token?: string } = {};
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => holder.token,
    });
    const login = await client.mockLogin("student");
    holder.token = login.token;

    const guest = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
    });

    async function other(persona: "organization_member" | "moderator") {
      const holder2: { token?: string } = {};
      const c = createCampusAgoraApiClient({
        baseUrl: "http://api.test",
        fetchImpl,
        authToken: () => holder2.token,
      });
      const l = await c.mockLogin(persona);
      holder2.token = l.token;
      return c;
    }

    const discussion = await client
      .createDiscussion({ title: "讨论", body: "正文", tags: [] })
      .then((created) => client.changeDiscussionStatus(created.id, "published"));

    return { client, guest, discussion, other };
  }

  test("a guest cannot create, reply, or promote", async () => {
    const { guest, discussion } = await harness();

    await expect(
      guest.createDiscussion({ title: "标题", body: "正文", tags: [] }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      guest.replyToDiscussion(discussion.id, "我也想知道"),
    ).rejects.toMatchObject({ status: 401 });
    await expect(guest.promoteDiscussion(discussion.id, {})).rejects.toMatchObject({
      status: 401,
    });
  });

  test("an archived discussion stays readable but takes no replies", async () => {
    const { client, guest, discussion } = await harness();

    const archived = await client.changeDiscussionStatus(discussion.id, "archived");
    expect(archived.moderationStatus).toBe("archived");

    // Readable by a guest, because an entry links back to it.
    await expect(guest.getDiscussion(discussion.id)).resolves.toMatchObject({
      moderationStatus: "archived",
    });

    await expect(
      client.replyToDiscussion(discussion.id, "还能回吗"),
    ).rejects.toMatchObject({ status: 409 });
  });

  test("illegal transitions are refused", async () => {
    const { client } = await harness();
    const draft = await client.createDiscussion({
      title: "草稿",
      body: "正文",
      tags: [],
    });

    await expect(
      client.changeDiscussionStatus(draft.id, "archived"),
    ).rejects.toMatchObject({ status: 403 });
  });

  test("a stranger cannot accept an answer", async () => {
    const { client, discussion, other } = await harness();
    const reply = await client.replyToDiscussion(discussion.id, "自答");
    const stranger = await other("organization_member");

    await expect(
      stranger.acceptDiscussionAnswer(discussion.id, reply.id),
    ).rejects.toMatchObject({ status: 403 });
  });

  test("a comment from another discussion cannot be accepted", async () => {
    const { client, discussion, other } = await harness();
    const stranger = await other("organization_member");

    const theirs = await stranger
      .createDiscussion({ title: "别人的", body: "正文", tags: [] })
      .then((created) => stranger.changeDiscussionStatus(created.id, "published"));
    const theirReply = await stranger.replyToDiscussion(theirs.id, "别人的回复");

    await expect(
      client.acceptDiscussionAnswer(discussion.id, theirReply.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  test("only a publicly readable discussion can be promoted", async () => {
    const { client } = await harness();
    const draft = await client.createDiscussion({
      title: "私密草稿",
      body: "正文",
      tags: [],
    });

    // Its own author can see it and still cannot sediment it.
    await expect(client.promoteDiscussion(draft.id, {})).rejects.toMatchObject({
      status: 409,
    });
  });

  test("reply bodies are validated the way the server validates them", async () => {
    const { client, discussion } = await harness();

    await expect(client.replyToDiscussion(discussion.id, "   ")).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      client.replyToDiscussion(discussion.id, "x".repeat(5001)),
    ).rejects.toMatchObject({ status: 422 });
  });

  test("an invisible discussion is 404 on every one of its endpoints", async () => {
    const { client, guest } = await harness();
    const draft = await client.createDiscussion({
      title: "草稿",
      body: "正文",
      tags: [],
    });

    await expect(guest.getDiscussion(draft.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(guest.listDiscussionReplies(draft.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(guest.listDiscussionDerivedEntries(draft.id)).rejects.toMatchObject({
      status: 404,
    });
  });
});

/**
 * The mock is the only backend apps/web tests ever see, so a bound the server
 * enforces and the mock does not is a hole in the web suite rather than a
 * cosmetic gap. Three milestones in a row have shipped a divergence of this
 * shape; these assert the whole set at once so the next handler cannot skip
 * one quietly.
 */
describe("mock enforces the server's content bounds", () => {
  async function authed() {
    const fetchImpl = createCampusAgoraMockFetch();
    const holder: { token?: string } = {};
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => holder.token,
    });
    holder.token = (await client.mockLogin("student")).token;
    return client;
  }

  async function published(client: CampusAgoraApiClient, title = "可晋升的讨论") {
    const created = await client.createDiscussion({ title, body: "正文", tags: [] });
    return client.changeDiscussionStatus(created.id, "published");
  }

  test("a discussion cannot carry more than ten tags", async () => {
    const client = await authed();

    await expect(
      client.createDiscussion({
        title: "多标签",
        body: "正文",
        tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  test("a discussion tag cannot exceed thirty-two characters", async () => {
    const client = await authed();

    await expect(
      client.createDiscussion({
        title: "长标签",
        body: "正文",
        tags: ["x".repeat(33)],
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  test("discussion tags are lowercased and deduped the way the server stores them", async () => {
    const client = await authed();

    const created = await client.createDiscussion({
      title: "重复标签",
      body: "正文",
      tags: ["Onboarding", "onboarding", " 新生 "],
    });

    expect(created.tags).toEqual(["onboarding", "新生"]);
  });

  test("a discussion title and body are bounded", async () => {
    const client = await authed();

    await expect(
      client.createDiscussion({ title: "t".repeat(201), body: "正文", tags: [] }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      client.createDiscussion({ title: "标题", body: "b".repeat(50001), tags: [] }),
    ).rejects.toMatchObject({ status: 422 });
  });

  /**
   * The concrete path: promoting a reply builds its title from the thread's,
   * so a legal thread title plus a suffix can exceed the entry limit. Without
   * this bound the web tests happily assert a navigation the server refuses.
   */
  test("a promotion's overridden fields are bounded", async () => {
    const client = await authed();
    const discussion = await published(client);

    await expect(
      client.promoteDiscussion(discussion.id, { title: "t".repeat(201) }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      client.promoteDiscussion(discussion.id, { summary: "s".repeat(501) }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      client.promoteDiscussion(discussion.id, { body: "b".repeat(50001) }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      client.promoteDiscussion(discussion.id, {
        tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  test("an over-long search term is rejected on both list endpoints", async () => {
    const client = await authed();

    await expect(client.listDiscussions({ q: "z".repeat(101) })).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      client.listKnowledgeEntries({ q: "z".repeat(101) }),
    ).rejects.toMatchObject({ status: 422 });
  });

  test("an archive entry's body and summary are bounded too", async () => {
    const client = await authed();
    const base = {
      title: "标题",
      tags: [],
      category: "other" as const,
      applicableAudience: "all_students" as const,
      sourceKind: "unspecified" as const,
    };

    await expect(
      client.createKnowledgeEntry({ ...base, body: "b".repeat(50001) }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      client.createKnowledgeEntry({ ...base, body: "正文", summary: "s".repeat(501) }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

/**
 * The mock is the only backend `apps/web` tests ever see. Three milestones in
 * a row shipped a rule the server enforced and the mock did not, so every M4
 * rule is asserted against the mock here.
 */
describe("moderation and AI drafting in the mock", () => {
  async function signedIn(persona: "student" | "moderator" | "organization_member") {
    const fetchImpl = createCampusAgoraMockFetch();
    return withFetch(fetchImpl, persona);
  }

  async function withFetch(
    fetchImpl: typeof fetch,
    persona: "student" | "moderator" | "organization_member",
  ) {
    const holder: { token?: string } = {};
    const client = createCampusAgoraApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      authToken: () => holder.token,
    });
    holder.token = (await client.mockLogin(persona)).token;
    return { client, fetchImpl };
  }

  async function publishedDiscussion(
    client: CampusAgoraApiClient,
    title = "会被举报的讨论",
  ) {
    const created = await client.createDiscussion({ title, body: "正文", tags: [] });
    await client.changeDiscussionStatus(created.id, "published");
    await client.replyToDiscussion(created.id, "一条有用的回复。");
    return created.id;
  }

  test("a guest cannot report", async () => {
    const fetchImpl = createCampusAgoraMockFetch();
    const { client } = await withFetch(fetchImpl, "student");
    const id = await publishedDiscussion(client);
    const guest = createCampusAgoraApiClient({ baseUrl: "http://api.test", fetchImpl });

    await expect(
      guest.createReport({ postId: id, category: "spam", message: "广告" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test("reporting does not take the content down", async () => {
    const { client } = await signedIn("student");
    const id = await publishedDiscussion(client);

    await client.createReport({
      postId: id,
      category: "privacy_violation",
      message: "泄露了手机号",
    });

    // The whole point: a report queues content, it does not hide it.
    await expect(client.getDiscussion(id)).resolves.toMatchObject({
      moderationStatus: "published",
    });
  });

  test("a duplicate open report is refused but a second reporter is not", async () => {
    const fetchImpl = createCampusAgoraMockFetch();
    const first = await withFetch(fetchImpl, "student");
    const id = await publishedDiscussion(first.client);

    await first.client.createReport({ postId: id, category: "spam", message: "广告" });
    await expect(
      first.client.createReport({ postId: id, category: "illegal", message: "再来" }),
    ).rejects.toMatchObject({ status: 409 });

    const second = await withFetch(fetchImpl, "organization_member");
    await expect(
      second.client.createReport({
        postId: id,
        category: "illegal",
        message: "我也看到了",
      }),
    ).resolves.toMatchObject({ postId: id });
  });

  test("the queue and the reports on an item are moderator-only", async () => {
    const fetchImpl = createCampusAgoraMockFetch();
    const author = await withFetch(fetchImpl, "student");
    const id = await publishedDiscussion(author.client);
    await author.client.createReport({
      postId: id,
      category: "illegal",
      message: "违法",
    });

    // Not even the content's own author, who a report may be about.
    await expect(author.client.listModerationQueue()).rejects.toMatchObject({
      status: 403,
    });
    await expect(author.client.listContentReports(id)).rejects.toMatchObject({
      status: 403,
    });

    const moderator = await withFetch(fetchImpl, "moderator");
    const queue = await moderator.client.listModerationQueue();
    const item = queue.items.find((entry) => entry.postId === id);

    expect(item?.risk).toBe("high");
    expect(item?.openReportCount).toBe(1);
    expect(item?.moderationStatus).toBe("published");
  });

  test("a report cannot be resolved through an unrelated item", async () => {
    const fetchImpl = createCampusAgoraMockFetch();
    const author = await withFetch(fetchImpl, "student");
    const reported = await publishedDiscussion(author.client, "被举报的");
    const unrelated = await publishedDiscussion(author.client, "无关的");
    const report = await author.client.createReport({
      postId: reported,
      category: "spam",
      message: "广告",
    });

    const moderator = await withFetch(fetchImpl, "moderator");
    await expect(
      moderator.client.resolveContentReport(unrelated, report.id, "dismissed"),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      moderator.client.resolveContentReport(reported, report.id, "dismissed"),
    ).resolves.toMatchObject({ resolution: "dismissed" });
  });

  test("a report message is bounded the way the server bounds it", async () => {
    const { client } = await signedIn("student");
    const id = await publishedDiscussion(client);

    await expect(
      client.createReport({ postId: id, category: "spam", message: "   " }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      client.createReport({ postId: id, category: "spam", message: "x".repeat(1001) }),
    ).rejects.toMatchObject({ status: 422 });
  });

  test("AI drafting is refused unless the capability is on", async () => {
    const { client } = await signedIn("student");
    const id = await publishedDiscussion(client);

    await expect(client.generateAiDraft(id)).rejects.toMatchObject({ status: 403 });
  });

  test("an AI draft is a draft with recorded sources and never a published entry", async () => {
    const fetchImpl = createCampusAgoraMockFetch({ aiArchiveEnabled: true });
    const { client } = await withFetch(fetchImpl, "student");
    const id = await publishedDiscussion(client, "场地申请流程");

    const drafted = await client.generateAiDraft(id);

    expect(drafted.entry.moderationStatus).toBe("draft");
    expect(drafted.entry.aiProvider).toBe("deterministic-v1");
    expect(drafted.entry.sourceKind).toBe("discussion");
    // The opening post plus the reply, each with its own author.
    expect(drafted.sources).toHaveLength(2);
    expect(drafted.sources.every((source) => source.sourcePostId === id)).toBe(true);
    expect(drafted.sources.every((source) => source.sourceAuthorName.length > 0)).toBe(
      true,
    );
  });

  test("only a publicly readable discussion can be drafted from", async () => {
    const fetchImpl = createCampusAgoraMockFetch({ aiArchiveEnabled: true });
    const { client } = await withFetch(fetchImpl, "student");
    const draft = await client.createDiscussion({
      title: "私密草稿",
      body: "正文",
      tags: [],
    });

    await expect(client.generateAiDraft(draft.id)).rejects.toMatchObject({
      status: 409,
    });
  });
});
