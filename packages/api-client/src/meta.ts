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
import type {
  CapabilityFlags,
  Correction,
  CorrectionCollection,
  CreateKnowledgeEntryRequest,
  HealthResponse,
  KnowledgeEntry,
  LoginResponse,
  MetaResponse,
  ModerationStatus,
  PaginatedKnowledgeEntries,
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

    resolveKnowledgeEntryCorrection(id, correctionId) {
      return resolveKnowledgeEntryCorrection(requestOptions, id, correctionId);
    },
  };
}

export type { CapabilityFlags, HealthResponse, MetaResponse, ReadinessResponse };
