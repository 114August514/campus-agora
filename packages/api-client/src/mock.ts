import type {
  Correction,
  CurrentUser,
  KnowledgeEntry,
  MetaResponse,
  MockLoginRequest,
  ModerationStatus,
  ReadinessResponse,
} from "./generated";

export interface CampusAgoraMockFetchOptions {
  meta?: Partial<MetaResponse>;
  readiness?: ReadinessResponse;
  /** Overrides the built-in personas with app-specific fixtures. */
  users?: Partial<Record<MockLoginRequest["persona"], CurrentUser>>;
  /** Session lifetime in seconds; mirrors SESSION_TTL_SECONDS. */
  sessionTtlSeconds?: number;
}

const DEFAULT_SESSION_TTL_SECONDS = 86400;

// Stable ids so a login is reproducible across calls, but still UUID-shaped
// like the real server's, so consumers that parse or shorten ids behave the
// same against both.
const DEFAULT_USERS: Record<MockLoginRequest["persona"], CurrentUser> = {
  student: {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "示例学生",
    systemRole: "student",
    organizations: [],
  },
  organization_member: {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "示例组织成员",
    systemRole: "organization_member",
    organizations: [
      {
        organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        slug: "demo-student-union",
        name: "示例学生会",
      },
    ],
  },
  moderator: {
    id: "33333333-3333-4333-8333-333333333333",
    displayName: "示例审核员",
    systemRole: "moderator",
    organizations: [],
  },
  admin: {
    id: "44444444-4444-4444-8444-444444444444",
    displayName: "示例管理员",
    systemRole: "admin",
    organizations: [],
  },
};

interface MockSession {
  user: CurrentUser;
  expiresAt: string;
}

/// Mirrors crates/domain::can_transition so the mock rejects exactly the
/// transitions the server rejects.
const ALLOWED_TRANSITIONS: ReadonlyArray<[ModerationStatus, ModerationStatus]> = [
  ["draft", "published"],
  ["draft", "rejected"],
  ["published", "hidden"],
  ["hidden", "published"],
  ["rejected", "draft"],
];

function canTransition(from: ModerationStatus, to: ModerationStatus): boolean {
  return ALLOWED_TRANSITIONS.some(([a, b]) => a === from && b === to);
}

/// Mirrors the SQL visibility predicate: published is public, and a viewer
/// additionally sees what they authored. Moderators and admins see all.
function canSee(entry: KnowledgeEntry, viewer: CurrentUser | undefined): boolean {
  if (entry.moderationStatus === "published") {
    return true;
  }

  if (!viewer) {
    return false;
  }

  return (
    viewer.systemRole === "moderator" ||
    viewer.systemRole === "admin" ||
    entry.authorId === viewer.id
  );
}

let mockIdCounter = 0;

function mockUuid(): string {
  mockIdCounter += 1;
  const suffix = mockIdCounter.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${suffix}`;
}

export function createCampusAgoraMockFetch(
  options: CampusAgoraMockFetchOptions = {},
): typeof fetch {
  const meta: MetaResponse = {
    appName: "Campus Agora",
    version: "0.1.0",
    capabilities: {
      authMockEnabled: true,
      desktopEnabled: true,
      aiArchiveEnabled: false,
      attachmentsEnabled: false,
    },
    ...options.meta,
  };
  const readiness = options.readiness ?? {
    status: "ready",
    checks: {
      postgres: "ok",
    },
  };
  const users = { ...DEFAULT_USERS, ...options.users };
  const ttlSeconds = options.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const activeSessions = new Map<string, MockSession>();
  const entries = new Map<string, KnowledgeEntry>();
  const revisions = new Map<string, Array<Record<string, unknown>>>();
  const corrections = new Map<string, Correction>();
  let tokenCounter = 0;

  function viewerFor(request: Request): CurrentUser | undefined {
    const token = bearerToken(request);
    const session = token ? activeSessions.get(token) : undefined;

    return session && Date.parse(session.expiresAt) > Date.now()
      ? session.user
      : undefined;
  }

  function isPersona(value: unknown): value is MockLoginRequest["persona"] {
    return typeof value === "string" && Object.hasOwn(users, value);
  }

  return async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    const requestId = request.headers.get("x-request-id") ?? "mock-request-id";

    if (path === "/healthz") {
      return textResponse("ok", requestId);
    }

    if (path === "/readyz") {
      // The server answers 503 when a dependency is down; a mock that always
      // returns 200 would hide every readiness failure from the client.
      const status = readiness.status === "ready" ? 200 : 503;
      return jsonResponse(readiness, status, requestId);
    }

    if (path === "/api/v1/meta") {
      return jsonResponse(meta, 200, requestId);
    }

    if (path === "/api/v1/auth/mock-login") {
      if (request.method !== "POST") {
        return methodNotAllowed("POST", requestId);
      }

      if (!meta.capabilities.authMockEnabled) {
        return errorResponse(
          403,
          "auth_mock_disabled",
          "Mock campus login is disabled",
          requestId,
        );
      }

      const body = (await request.json().catch(() => undefined)) as
        | { persona?: unknown }
        | undefined;

      // The server distinguishes a body it cannot parse (400) from a
      // well-formed body naming an unknown persona (422).
      if (
        typeof body !== "object" ||
        body === null ||
        typeof body.persona !== "string"
      ) {
        return errorResponse(
          400,
          "invalid_request_body",
          "Request body must be valid JSON",
          requestId,
        );
      }

      if (!isPersona(body.persona)) {
        return errorResponse(
          422,
          "validation_failed",
          "Unknown mock persona",
          requestId,
        );
      }

      tokenCounter += 1;
      const token = `mock-session-token-${tokenCounter}`;
      const session: MockSession = {
        user: users[body.persona],
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };
      activeSessions.set(token, session);

      return jsonResponse(
        { token, expiresAt: session.expiresAt, user: session.user },
        200,
        requestId,
      );
    }

    if (path === "/api/v1/auth/session" || path === "/api/v1/auth/logout") {
      const isLogout = path === "/api/v1/auth/logout";
      const allowed = isLogout ? "POST" : "GET";

      if (request.method !== allowed) {
        return methodNotAllowed(allowed, requestId);
      }

      const token = bearerToken(request);
      const session = token ? activeSessions.get(token) : undefined;

      if (!token || !session || Date.parse(session.expiresAt) <= Date.now()) {
        if (token && session) {
          activeSessions.delete(token);
        }

        return errorResponse(
          401,
          "unauthorized",
          "Authentication is required",
          requestId,
        );
      }

      if (isLogout) {
        activeSessions.delete(token);
        return emptyResponse(204, requestId);
      }

      return jsonResponse(
        { user: session.user, expiresAt: session.expiresAt },
        200,
        requestId,
      );
    }

    const archiveMatch =
      /^\/api\/v1\/knowledge-entries(?:\/([^/]+))?(?:\/(status|revisions|corrections))?(?:\/([^/]+)\/resolve)?$/.exec(
        path,
      );

    if (archiveMatch) {
      const [, entryId, subresource, correctionId] = archiveMatch;
      const viewer = viewerFor(request);
      const unauthorized = () =>
        errorResponse(401, "unauthorized", "Authentication is required", requestId);
      const notFound = () =>
        errorResponse(404, "not_found", "Resource not found", requestId);

      // Collection.
      if (!entryId) {
        if (request.method === "GET") {
          const url = new URL(request.url);
          const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
          const page = Number(url.searchParams.get("page") ?? "1");

          if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
            return errorResponse(
              400,
              "invalid_query",
              "Query parameters are invalid",
              requestId,
            );
          }

          if (page < 1 || pageSize < 1 || pageSize > 100) {
            return errorResponse(
              422,
              "validation_failed",
              "page and pageSize are out of range",
              requestId,
            );
          }

          const q = url.searchParams.get("q")?.toLowerCase();
          const tag = url.searchParams.get("tag")?.toLowerCase();
          const category = url.searchParams.get("category");
          const matched = [...entries.values()]
            .filter((entry) => canSee(entry, viewer))
            .filter(
              (entry) =>
                !q ||
                entry.title.toLowerCase().includes(q) ||
                (entry.summary ?? "").toLowerCase().includes(q),
            )
            .filter((entry) => !tag || entry.tags.includes(tag))
            .filter((entry) => !category || entry.category === category);

          const totalItems = matched.length;
          return jsonResponse(
            {
              items: matched.slice((page - 1) * pageSize, page * pageSize),
              page,
              pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / pageSize),
            },
            200,
            requestId,
          );
        }

        if (request.method === "POST") {
          if (!viewer) {
            return unauthorized();
          }

          const body = (await request.json().catch(() => undefined)) as
            | Record<string, unknown>
            | undefined;

          if (
            !body ||
            typeof body.title !== "string" ||
            typeof body.body !== "string"
          ) {
            return errorResponse(
              400,
              "invalid_request_body",
              "Request body is invalid",
              requestId,
            );
          }

          if (body.title.trim().length === 0) {
            return errorResponse(
              422,
              "validation_failed",
              "title must not be empty",
              requestId,
            );
          }

          const timestamp = new Date().toISOString();
          const entry: KnowledgeEntry = {
            id: mockUuid(),
            authorId: viewer.id,
            title: body.title.trim(),
            body: body.body,
            summary: typeof body.summary === "string" ? body.summary : undefined,
            tags: Array.isArray(body.tags)
              ? [...new Set(body.tags.map((tag) => String(tag).trim().toLowerCase()))]
              : [],
            category: (body.category as KnowledgeEntry["category"]) ?? "other",
            applicableAudience:
              (body.applicableAudience as KnowledgeEntry["applicableAudience"]) ??
              "all_students",
            sourceKind:
              (body.sourceKind as KnowledgeEntry["sourceKind"]) ?? "unspecified",
            sourceReference:
              typeof body.sourceReference === "string"
                ? body.sourceReference
                : undefined,
            moderationStatus: "draft",
            currentRevision: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          entries.set(entry.id, entry);
          revisions.set(entry.id, [
            {
              id: mockUuid(),
              revision: 1,
              editorId: viewer.id,
              title: entry.title,
              body: entry.body,
              summary: entry.summary,
              tags: entry.tags,
              createdAt: timestamp,
            },
          ]);

          return jsonResponse(entry, 201, requestId);
        }

        return methodNotAllowed("GET, POST", requestId);
      }

      const entry = entries.get(entryId);

      if (!entry || !canSee(entry, viewer)) {
        return notFound();
      }

      if (!subresource) {
        if (request.method === "GET") {
          return jsonResponse(entry, 200, requestId);
        }

        if (request.method === "PATCH") {
          if (!viewer) {
            return unauthorized();
          }

          if (entry.authorId !== viewer.id && viewer.systemRole === "student") {
            return errorResponse(403, "forbidden", "Not allowed", requestId);
          }

          const body = (await request.json().catch(() => undefined)) as
            | Record<string, unknown>
            | undefined;

          if (!body) {
            return errorResponse(
              400,
              "invalid_request_body",
              "Request body is invalid",
              requestId,
            );
          }

          const timestamp = new Date().toISOString();
          const updated: KnowledgeEntry = {
            ...entry,
            title: typeof body.title === "string" ? body.title.trim() : entry.title,
            body: typeof body.body === "string" ? body.body : entry.body,
            updatedAt: timestamp,
            // A published entry gains a revision; a draft updates in place.
            currentRevision:
              entry.moderationStatus === "published"
                ? entry.currentRevision + 1
                : entry.currentRevision,
          };
          entries.set(entry.id, updated);

          if (entry.moderationStatus === "published") {
            revisions.get(entry.id)?.push({
              id: mockUuid(),
              revision: updated.currentRevision,
              editorId: viewer.id,
              title: updated.title,
              body: updated.body,
              summary: updated.summary,
              tags: updated.tags,
              createdAt: timestamp,
            });
          }

          return jsonResponse(updated, 200, requestId);
        }

        return methodNotAllowed("GET, PATCH", requestId);
      }

      if (subresource === "status") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }

        if (!viewer) {
          return unauthorized();
        }

        const body = (await request.json().catch(() => undefined)) as
          | { status?: unknown }
          | undefined;

        if (!body || typeof body.status !== "string") {
          return errorResponse(
            400,
            "invalid_request_body",
            "Request body is invalid",
            requestId,
          );
        }

        const target = body.status as ModerationStatus;

        if (!canTransition(entry.moderationStatus, target)) {
          return errorResponse(
            409,
            "conflict",
            `cannot move an entry from ${entry.moderationStatus} to ${target}`,
            requestId,
          );
        }

        const updated: KnowledgeEntry = {
          ...entry,
          moderationStatus: target,
          updatedAt: new Date().toISOString(),
        };
        entries.set(entry.id, updated);

        return jsonResponse(updated, 200, requestId);
      }

      if (subresource === "revisions") {
        if (request.method !== "GET") {
          return methodNotAllowed("GET", requestId);
        }

        return jsonResponse({ items: revisions.get(entry.id) ?? [] }, 200, requestId);
      }

      // Corrections, including the nested resolve action.
      if (correctionId) {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }

        if (!viewer) {
          return unauthorized();
        }

        const correction = corrections.get(correctionId);

        if (!correction) {
          return notFound();
        }

        const canResolve =
          entry.authorId === viewer.id ||
          viewer.systemRole === "moderator" ||
          viewer.systemRole === "admin";

        if (!canResolve) {
          return errorResponse(403, "forbidden", "Not allowed", requestId);
        }

        // Idempotent: the first resolution wins, matching the server.
        const resolved: Correction = correction.resolvedAt
          ? correction
          : {
              ...correction,
              resolvedAt: new Date().toISOString(),
              resolvedBy: viewer.id,
            };
        corrections.set(correctionId, resolved);

        return jsonResponse(resolved, 200, requestId);
      }

      if (request.method === "GET") {
        return jsonResponse(
          {
            items: [...corrections.values()].filter(
              (correction) => correction.postId === entry.id,
            ),
          },
          200,
          requestId,
        );
      }

      if (request.method === "POST") {
        if (!viewer) {
          return unauthorized();
        }

        const body = (await request.json().catch(() => undefined)) as
          | { message?: unknown }
          | undefined;

        if (!body || typeof body.message !== "string") {
          return errorResponse(
            400,
            "invalid_request_body",
            "Request body is invalid",
            requestId,
          );
        }

        if (body.message.trim().length === 0) {
          return errorResponse(
            422,
            "validation_failed",
            "correction message must not be empty",
            requestId,
          );
        }

        const correction: Correction = {
          id: mockUuid(),
          postId: entry.id,
          reporterId: viewer.id,
          message: body.message.trim(),
          createdAt: new Date().toISOString(),
        };
        corrections.set(correction.id, correction);

        return jsonResponse(correction, 201, requestId);
      }

      return methodNotAllowed("GET, POST", requestId);
    }

    return errorResponse(404, "not_found", "Route not found", requestId);
  };
}

/// RFC 7235 makes the auth scheme case-insensitive, matching the server.
function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");

  if (!header) {
    return undefined;
  }

  const separator = header.search(/\s/);

  if (separator < 0 || !/^bearer$/i.test(header.slice(0, separator))) {
    return undefined;
  }

  const token = header.slice(separator + 1).trim();
  return token.length > 0 ? token : undefined;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
): Response {
  return jsonResponse({ code, message, requestId }, status, requestId);
}

function methodNotAllowed(allow: string, requestId: string): Response {
  return new Response(null, {
    status: 405,
    headers: {
      allow,
      "x-request-id": requestId,
    },
  });
}

function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
  });
}

function emptyResponse(status: number, requestId: string): Response {
  return new Response(null, {
    status,
    headers: {
      "x-request-id": requestId,
    },
  });
}

function textResponse(body: string, requestId: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain",
      "x-request-id": requestId,
    },
  });
}
