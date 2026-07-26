import type {
  ChangeStatusRequest,
  Correction,
  CorrectionCollection,
  CreateKnowledgeEntryRequest,
  KnowledgeEntry,
  ModerationStatus,
  PaginatedKnowledgeEntries,
  RevisionCollection,
  UpdateKnowledgeEntryRequest,
} from "./generated";
import { requestJson } from "./request";
import type { RequestOptions } from "./request";

export interface ListKnowledgeEntriesParams {
  /** Case-insensitive match over title and summary. */
  q?: string;
  tag?: string;
  category?: KnowledgeEntry["category"];
  /** 1-based. */
  page?: number;
  /** Defaults to 20, maximum 100. */
  pageSize?: number;
}

const BASE = "/api/v1/knowledge-entries";

function withQuery(params: ListKnowledgeEntriesParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `${BASE}?${query}` : BASE;
}

export function listKnowledgeEntries(
  options: RequestOptions,
  params: ListKnowledgeEntriesParams = {},
): Promise<PaginatedKnowledgeEntries> {
  return requestJson<PaginatedKnowledgeEntries>(options, withQuery(params));
}

export function getKnowledgeEntry(
  options: RequestOptions,
  id: string,
): Promise<KnowledgeEntry> {
  return requestJson<KnowledgeEntry>(options, `${BASE}/${id}`);
}

export function createKnowledgeEntry(
  options: RequestOptions,
  body: CreateKnowledgeEntryRequest,
): Promise<KnowledgeEntry> {
  return requestJson<KnowledgeEntry>(options, BASE, { method: "POST", body });
}

export function updateKnowledgeEntry(
  options: RequestOptions,
  id: string,
  body: UpdateKnowledgeEntryRequest,
): Promise<KnowledgeEntry> {
  return requestJson<KnowledgeEntry>(options, `${BASE}/${id}`, {
    method: "PATCH",
    body,
  });
}

export function changeKnowledgeEntryStatus(
  options: RequestOptions,
  id: string,
  status: ModerationStatus,
): Promise<KnowledgeEntry> {
  const body: ChangeStatusRequest = { status };

  return requestJson<KnowledgeEntry>(options, `${BASE}/${id}/status`, {
    method: "POST",
    body,
  });
}

export function listKnowledgeEntryRevisions(
  options: RequestOptions,
  id: string,
): Promise<RevisionCollection> {
  return requestJson<RevisionCollection>(options, `${BASE}/${id}/revisions`);
}

export function listKnowledgeEntryCorrections(
  options: RequestOptions,
  id: string,
): Promise<CorrectionCollection> {
  return requestJson<CorrectionCollection>(options, `${BASE}/${id}/corrections`);
}

export function fileKnowledgeEntryCorrection(
  options: RequestOptions,
  id: string,
  message: string,
): Promise<Correction> {
  return requestJson<Correction>(options, `${BASE}/${id}/corrections`, {
    method: "POST",
    body: { message },
  });
}

export function resolveKnowledgeEntryCorrection(
  options: RequestOptions,
  id: string,
  correctionId: string,
): Promise<Correction> {
  return requestJson<Correction>(
    options,
    `${BASE}/${id}/corrections/${correctionId}/resolve`,
    { method: "POST" },
  );
}
