export interface RequestOptions {
  baseUrl: string;
  fetchImpl: typeof fetch;
}

export class CampusAgoraApiError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "CampusAgoraApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

export async function requestJson<T>(
  options: RequestOptions,
  path: string
): Promise<T> {
  const response = await options.fetchImpl(`${options.baseUrl}${path}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new CampusAgoraApiError(
      `Campus Agora API request failed with ${response.status}`,
      response.status,
      response.headers.get("x-request-id") ?? undefined
    );
  }

  return (await response.json()) as T;
}
