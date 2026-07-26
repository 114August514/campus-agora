import type {
  AcceptAnswerRequest,
  ArchiveSourceCollection,
  ChangeStatusRequest,
  CreateDiscussionRequest,
  DerivedEntryCollection,
  Discussion,
  DiscussionReply,
  DiscussionReplyCollection,
  ModerationStatus,
  PaginatedDiscussions,
  PromoteRequest,
  Promotion,
  ReplyRequest,
} from "./generated";
import { requestJson } from "./request";
import type { RequestOptions } from "./request";

export interface ListDiscussionsParams {
  /** Case-insensitive match over title and body. */
  q?: string;
  tag?: string;
  /** 1-based. */
  page?: number;
  /** Defaults to 20, maximum 100. */
  pageSize?: number;
}

const BASE = "/api/v1/discussions";
const ENTRIES = "/api/v1/knowledge-entries";

function withQuery(params: ListDiscussionsParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `${BASE}?${query}` : BASE;
}

export function listDiscussions(
  options: RequestOptions,
  params: ListDiscussionsParams = {},
): Promise<PaginatedDiscussions> {
  return requestJson<PaginatedDiscussions>(options, withQuery(params));
}

export function getDiscussion(
  options: RequestOptions,
  id: string,
): Promise<Discussion> {
  return requestJson<Discussion>(options, `${BASE}/${id}`);
}

export function createDiscussion(
  options: RequestOptions,
  body: CreateDiscussionRequest,
): Promise<Discussion> {
  return requestJson<Discussion>(options, BASE, { method: "POST", body });
}

export function changeDiscussionStatus(
  options: RequestOptions,
  id: string,
  status: ModerationStatus,
): Promise<Discussion> {
  const body: ChangeStatusRequest = { status };

  return requestJson<Discussion>(options, `${BASE}/${id}/status`, {
    method: "POST",
    body,
  });
}

export function listDiscussionReplies(
  options: RequestOptions,
  id: string,
): Promise<DiscussionReplyCollection> {
  return requestJson<DiscussionReplyCollection>(options, `${BASE}/${id}/replies`);
}

export function replyToDiscussion(
  options: RequestOptions,
  id: string,
  body: string,
): Promise<DiscussionReply> {
  const payload: ReplyRequest = { body };

  return requestJson<DiscussionReply>(options, `${BASE}/${id}/replies`, {
    method: "POST",
    body: payload,
  });
}

/// Pass `null` to clear the accepted answer.
export function acceptDiscussionAnswer(
  options: RequestOptions,
  id: string,
  commentId: string | null,
): Promise<Discussion> {
  const payload: AcceptAnswerRequest = { commentId };

  return requestJson<Discussion>(options, `${BASE}/${id}/accepted-answer`, {
    method: "POST",
    body: payload,
  });
}

/// Creates a new archive draft owned by the caller and records where it came
/// from. The discussion is not modified and can be promoted again.
export function promoteDiscussion(
  options: RequestOptions,
  id: string,
  body: PromoteRequest,
): Promise<Promotion> {
  return requestJson<Promotion>(options, `${BASE}/${id}/promotions`, {
    method: "POST",
    body,
  });
}

export function listDiscussionDerivedEntries(
  options: RequestOptions,
  id: string,
): Promise<DerivedEntryCollection> {
  return requestJson<DerivedEntryCollection>(options, `${BASE}/${id}/derived-entries`);
}

export function listKnowledgeEntrySources(
  options: RequestOptions,
  id: string,
): Promise<ArchiveSourceCollection> {
  return requestJson<ArchiveSourceCollection>(options, `${ENTRIES}/${id}/sources`);
}
