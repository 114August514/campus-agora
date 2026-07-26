import type {
  CurrentUser,
  MetaResponse,
  MockLoginRequest,
  ReadinessResponse,
} from "./generated";

export interface CampusAgoraMockFetchOptions {
  meta?: Partial<MetaResponse>;
  readiness?: ReadinessResponse;
}

const MOCK_SESSION_EXPIRES_AT = "2026-07-27T12:00:00Z";

const MOCK_USERS: Record<MockLoginRequest["persona"], CurrentUser> = {
  student: {
    id: "mock-user-student",
    displayName: "示例学生",
    systemRole: "student",
    organizations: [],
  },
  organization_member: {
    id: "mock-user-organization-member",
    displayName: "示例组织成员",
    systemRole: "organization_member",
    organizations: [
      {
        organizationId: "mock-organization-1",
        slug: "demo-student-union",
        name: "示例学生会",
      },
    ],
  },
  moderator: {
    id: "mock-user-moderator",
    displayName: "示例审核员",
    systemRole: "moderator",
    organizations: [],
  },
  admin: {
    id: "mock-user-admin",
    displayName: "示例管理员",
    systemRole: "admin",
    organizations: [],
  },
};

function isMockPersona(value: unknown): value is MockLoginRequest["persona"] {
  return typeof value === "string" && value in MOCK_USERS;
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
  const activeSessions = new Map<string, CurrentUser>();
  let tokenCounter = 0;

  return async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    const requestId = request.headers.get("x-request-id") ?? "mock-request-id";

    if (path === "/healthz") {
      return textResponse("ok", requestId);
    }

    if (path === "/readyz") {
      return jsonResponse(readiness, 200, requestId);
    }

    if (path === "/api/v1/meta") {
      return jsonResponse(meta, 200, requestId);
    }

    if (path === "/api/v1/auth/mock-login" && request.method === "POST") {
      const body = (await request.json().catch(() => undefined)) as
        | { persona?: unknown }
        | undefined;

      if (!body || !isMockPersona(body.persona)) {
        return jsonResponse(
          {
            code: "validation_failed",
            message: "Unknown mock persona",
            requestId,
          },
          422,
          requestId,
        );
      }

      tokenCounter += 1;
      const token = `mock-session-token-${tokenCounter}`;
      const user = MOCK_USERS[body.persona];
      activeSessions.set(token, user);

      return jsonResponse(
        { token, expiresAt: MOCK_SESSION_EXPIRES_AT, user },
        200,
        requestId,
      );
    }

    if (path === "/api/v1/auth/session" || path === "/api/v1/auth/logout") {
      const token = bearerToken(request);
      const user = token ? activeSessions.get(token) : undefined;

      if (!token || !user) {
        return jsonResponse(
          {
            code: "unauthorized",
            message: "Authentication is required",
            requestId,
          },
          401,
          requestId,
        );
      }

      if (path === "/api/v1/auth/logout" && request.method === "POST") {
        activeSessions.delete(token);
        return emptyResponse(204, requestId);
      }

      return jsonResponse({ user, expiresAt: MOCK_SESSION_EXPIRES_AT }, 200, requestId);
    }

    return jsonResponse(
      {
        code: "not_found",
        message: "Route not found",
        requestId,
      },
      404,
      requestId,
    );
  };
}

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
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
