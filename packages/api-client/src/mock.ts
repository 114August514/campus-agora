import type { MetaResponse, ReadinessResponse } from "./generated";

export interface CampusAgoraMockFetchOptions {
  meta?: Partial<MetaResponse>;
  readiness?: ReadinessResponse;
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

  return async (input) => {
    const request = new Request(input);
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

function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
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
