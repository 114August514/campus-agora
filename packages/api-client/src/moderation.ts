import type {
  AiDraft,
  ContentReport,
  ContentReportCollection,
  CreateReportRequest,
  PaginatedModerationQueue,
  ReportResolution,
} from "./generated";
import { requestJson } from "./request";
import type { RequestOptions } from "./request";

export interface ModerationQueueParams {
  /** 1-based. */
  page?: number;
  /** Defaults to 20, maximum 100. */
  pageSize?: number;
}

const REPORTS = "/api/v1/reports";
const MODERATION = "/api/v1/moderation";

/**
 * Reports any content, discussion or archive entry alike. The target is in the
 * body rather than the path because a report applies to both, and inventing a
 * URL for the union would say less about what it points at.
 *
 * Filing a report does not take the content down; it queues it for a decision.
 */
export function createReport(
  options: RequestOptions,
  body: CreateReportRequest,
): Promise<ContentReport> {
  return requestJson<ContentReport>(options, REPORTS, { method: "POST", body });
}

/** Moderators and admins only. */
export function listModerationQueue(
  options: RequestOptions,
  params: ModerationQueueParams = {},
): Promise<PaginatedModerationQueue> {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return requestJson<PaginatedModerationQueue>(
    options,
    query ? `${MODERATION}/queue?${query}` : `${MODERATION}/queue`,
  );
}

/**
 * The reports filed against one piece of content. Restricted to moderation:
 * a report names its reporter and may be about the content's own author.
 */
export function listContentReports(
  options: RequestOptions,
  id: string,
): Promise<ContentReportCollection> {
  return requestJson<ContentReportCollection>(
    options,
    `${MODERATION}/content/${id}/reports`,
  );
}

export function resolveContentReport(
  options: RequestOptions,
  id: string,
  reportId: string,
  resolution: ReportResolution,
): Promise<ContentReport> {
  return requestJson<ContentReport>(
    options,
    `${MODERATION}/content/${id}/reports/${reportId}/resolve`,
    { method: "POST", body: { resolution } },
  );
}

/**
 * Composes an archive draft from a public discussion. What comes back is
 * always a draft the caller owns, with the sources it drew from; there is no
 * parameter by which it could be asked to publish.
 */
export function generateAiDraft(options: RequestOptions, id: string): Promise<AiDraft> {
  return requestJson<AiDraft>(options, `/api/v1/discussions/${id}/ai-draft`, {
    method: "POST",
  });
}
