import {
  changeKnowledgeEntryStatus,
  createKnowledgeEntry,
  fileKnowledgeEntryCorrection,
  getKnowledgeEntry,
  listKnowledgeEntries,
  listKnowledgeEntryCorrections,
  listKnowledgeEntryRevisions,
  resolveKnowledgeEntryCorrection,
  updateKnowledgeEntry,
} from "./archive";
import type { ListKnowledgeEntriesParams } from "./archive";
import { getAuthSession, logout, mockLogin } from "./auth";
import type { MockPersona } from "./auth";
import {
  acceptDiscussionAnswer,
  changeDiscussionStatus,
  createDiscussion,
  getDiscussion,
  listDiscussionDerivedEntries,
  listDiscussionReplies,
  listDiscussions,
  listKnowledgeEntrySources,
  promoteDiscussion,
  replyToDiscussion,
} from "./discussion";
import type { ListDiscussionsParams } from "./discussion";
import type {
  ArchiveSourceCollection,
  CapabilityFlags,
  Correction,
  CorrectionCollection,
  CreateDiscussionRequest,
  CreateKnowledgeEntryRequest,
  DerivedEntryCollection,
  Discussion,
  DiscussionReply,
  DiscussionReplyCollection,
  HealthResponse,
  KnowledgeEntry,
  LoginResponse,
  MetaResponse,
  ModerationStatus,
  PaginatedDiscussions,
  PaginatedKnowledgeEntries,
  PromoteRequest,
  Promotion,
  ReadinessResponse,
  RevisionCollection,
  SessionResponse,
  UpdateKnowledgeEntryRequest,
} from "./generated";
import { requestJson } from "./request";

export interface CampusAgoraApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestId?: () => string;
  /** Returns the current session token; omitted or undefined means guest. */
  authToken?: () => string | undefined;
}

export interface CampusAgoraApiClient {
  getHealth(): Promise<HealthResponse>;
  getReady(): Promise<ReadinessResponse>;
  getMeta(): Promise<MetaResponse>;
  mockLogin(persona: MockPersona): Promise<LoginResponse>;
  getAuthSession(): Promise<SessionResponse>;
  logout(): Promise<void>;
  listKnowledgeEntries(
    params?: ListKnowledgeEntriesParams,
  ): Promise<PaginatedKnowledgeEntries>;
  getKnowledgeEntry(id: string): Promise<KnowledgeEntry>;
  createKnowledgeEntry(body: CreateKnowledgeEntryRequest): Promise<KnowledgeEntry>;
  updateKnowledgeEntry(
    id: string,
    body: UpdateKnowledgeEntryRequest,
  ): Promise<KnowledgeEntry>;
  changeKnowledgeEntryStatus(
    id: string,
    status: ModerationStatus,
  ): Promise<KnowledgeEntry>;
  listKnowledgeEntryRevisions(id: string): Promise<RevisionCollection>;
  listKnowledgeEntryCorrections(id: string): Promise<CorrectionCollection>;
  fileKnowledgeEntryCorrection(id: string, message: string): Promise<Correction>;
  resolveKnowledgeEntryCorrection(
    id: string,
    correctionId: string,
  ): Promise<Correction>;
  listKnowledgeEntrySources(id: string): Promise<ArchiveSourceCollection>;
  listDiscussions(params?: ListDiscussionsParams): Promise<PaginatedDiscussions>;
  getDiscussion(id: string): Promise<Discussion>;
  createDiscussion(body: CreateDiscussionRequest): Promise<Discussion>;
  changeDiscussionStatus(id: string, status: ModerationStatus): Promise<Discussion>;
  listDiscussionReplies(id: string): Promise<DiscussionReplyCollection>;
  replyToDiscussion(id: string, body: string): Promise<DiscussionReply>;
  /** Pass `null` to clear the accepted answer. */
  acceptDiscussionAnswer(id: string, commentId: string | null): Promise<Discussion>;
  promoteDiscussion(id: string, body: PromoteRequest): Promise<Promotion>;
  listDiscussionDerivedEntries(id: string): Promise<DerivedEntryCollection>;
}

export function createCampusAgoraApiClient(
  options: CampusAgoraApiClientOptions = {},
): CampusAgoraApiClient {
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:8080";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const requestOptions = {
    baseUrl,
    fetchImpl,
    requestId: options.requestId,
    authToken: options.authToken,
  };

  return {
    async getHealth() {
      const response = await fetchImpl(`${baseUrl}/healthz`, {
        headers: {
          Accept: "text/plain",
        },
      });

      if (!response.ok) {
        throw new Error(`Campus Agora health check failed with ${response.status}`);
      }

      return (await response.text()) as HealthResponse;
    },

    getReady() {
      return requestJson<ReadinessResponse>(requestOptions, "/readyz");
    },

    getMeta() {
      return requestJson<MetaResponse>(requestOptions, "/api/v1/meta");
    },

    mockLogin(persona) {
      return mockLogin(requestOptions, persona);
    },

    getAuthSession() {
      return getAuthSession(requestOptions);
    },

    logout() {
      return logout(requestOptions);
    },

    listKnowledgeEntries(params) {
      return listKnowledgeEntries(requestOptions, params);
    },

    getKnowledgeEntry(id) {
      return getKnowledgeEntry(requestOptions, id);
    },

    createKnowledgeEntry(body) {
      return createKnowledgeEntry(requestOptions, body);
    },

    updateKnowledgeEntry(id, body) {
      return updateKnowledgeEntry(requestOptions, id, body);
    },

    changeKnowledgeEntryStatus(id, status) {
      return changeKnowledgeEntryStatus(requestOptions, id, status);
    },

    listKnowledgeEntryRevisions(id) {
      return listKnowledgeEntryRevisions(requestOptions, id);
    },

    listKnowledgeEntryCorrections(id) {
      return listKnowledgeEntryCorrections(requestOptions, id);
    },

    fileKnowledgeEntryCorrection(id, message) {
      return fileKnowledgeEntryCorrection(requestOptions, id, message);
    },

    listKnowledgeEntrySources(id) {
      return listKnowledgeEntrySources(requestOptions, id);
    },

    listDiscussions(params) {
      return listDiscussions(requestOptions, params);
    },

    getDiscussion(id) {
      return getDiscussion(requestOptions, id);
    },

    createDiscussion(body) {
      return createDiscussion(requestOptions, body);
    },

    changeDiscussionStatus(id, status) {
      return changeDiscussionStatus(requestOptions, id, status);
    },

    listDiscussionReplies(id) {
      return listDiscussionReplies(requestOptions, id);
    },

    replyToDiscussion(id, body) {
      return replyToDiscussion(requestOptions, id, body);
    },

    acceptDiscussionAnswer(id, commentId) {
      return acceptDiscussionAnswer(requestOptions, id, commentId);
    },

    promoteDiscussion(id, body) {
      return promoteDiscussion(requestOptions, id, body);
    },

    listDiscussionDerivedEntries(id) {
      return listDiscussionDerivedEntries(requestOptions, id);
    },

    resolveKnowledgeEntryCorrection(id, correctionId) {
      return resolveKnowledgeEntryCorrection(requestOptions, id, correctionId);
    },
  };
}

export type { CapabilityFlags, HealthResponse, MetaResponse, ReadinessResponse };
