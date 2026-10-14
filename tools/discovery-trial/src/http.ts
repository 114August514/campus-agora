export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** POST/GET JSON with an abort signal. Error messages never include request headers. */
export async function fetchJson<T>(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown },
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(
      response.status,
      `HTTP ${response.status}: ${text.slice(0, 300)}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(response.status, `响应不是 JSON: ${text.slice(0, 200)}`);
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "请求超时";
    if (error.name === "AbortError") return "请求被中止";
    return error.message;
  }
  return String(error);
}
