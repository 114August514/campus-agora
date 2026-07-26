import type {
  CurrentUser,
  MetaResponse,
  MockLoginRequest,
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
  let tokenCounter = 0;

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
      if (typeof body !== "object" || body === null || typeof body.persona !== "string") {
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
