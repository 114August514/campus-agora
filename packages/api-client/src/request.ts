export interface RequestOptions {
  baseUrl: string;
  fetchImpl: typeof fetch;
  requestId?: () => string;
}

export class CampusAgoraApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(
    message: string,
    options: {
      code: string;
      status: number;
      requestId?: string;
    }
  ) {
    super(message);
    this.name = "CampusAgoraApiError";
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
  }
}

export async function requestJson<T>(
  options: RequestOptions,
  path: string
): Promise<T> {
  let response: Response;

  try {
    response = await options.fetchImpl(`${options.baseUrl}${path}`, {
      headers: requestHeaders(options)
    });
  } catch (error) {
    throw new CampusAgoraApiError(
      error instanceof Error ? error.message : "Network request failed",
      {
        code: "network_error",
        status: 0
      }
    );
  }

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id") ?? undefined;
    const fallback = {
      code: statusCodeToErrorCode(response.status),
      message: `Campus Agora API request failed with ${response.status}`,
      requestId
    };

    const body = await responseJson(response);
    const apiError = parseApiError(body);

    throw new CampusAgoraApiError(apiError?.message ?? fallback.message, {
      code: apiError?.code ?? fallback.code,
      status: response.status,
      requestId
    });
  }

  return (await response.json()) as T;
}

export function requestHeaders(options: RequestOptions): Headers {
  const headers = new Headers({
    Accept: "application/json"
  });

  const requestId = options.requestId?.();

  if (requestId) {
    headers.set("x-request-id", requestId);
  }

  return headers;
}

function parseApiError(body: unknown):
  | {
      code: string;
      message: string;
    }
  | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const error = body.error;

  if (!isRecord(error)) {
    return undefined;
  }

  if (typeof error.code !== "string" || typeof error.message !== "string") {
    return undefined;
  }

  return {
    code: error.code,
    message: error.message
  };
}

async function responseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function statusCodeToErrorCode(status: number): string {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation_failed";
    case 429:
      return "rate_limited";
    default:
      return "api_error";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
