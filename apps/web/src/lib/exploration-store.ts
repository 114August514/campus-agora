export interface SourceSnapshot {
  url: string;
  lookupUrl?: string;
  accessNote?: string;
  title: string;
  content: string;
  collectedAt: string;
  kind?: "snapshot" | "live";
  // Preserve the original page label; it is not necessarily an ISO date.
  publishedAt?: string;
  query?: string;
  relevanceEvidence?: string[];
  unknowns?: string[];
  collection?: SourceCollection;
}

export interface SourceCollection {
  method: "browser_dom" | "web_read";
  contentKind: "summary" | "body";
  readStatus: "partial" | "complete";
  scope: string;
  batchId: string;
}

export interface CandidateSnapshot {
  candidateId: string;
  name: string;
  institution: string;
  research: string;
  sources: SourceSnapshot[];
}

export interface TopicCandidate {
  candidate: CandidateSnapshot;
  reason: string;
  questions: string[];
  savedAt: string;
}

export interface ExplorationTopic {
  id: string;
  name: string;
  question: string;
  preferences: string;
  createdAt: string;
  updatedAt: string;
  candidates: TopicCandidate[];
}

export type ExplorationStoreErrorCode =
  | "read_failed"
  | "write_failed"
  | "corrupted_data"
  | "unsupported_version"
  | "validation_failed"
  | "not_found";

export class ExplorationStoreError extends Error {
  constructor(
    public readonly code: ExplorationStoreErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ExplorationStoreError";
  }
}

interface StoredExplorations {
  version: 1;
  topics: ExplorationTopic[];
}

interface PrivateRecordPatch {
  reason?: string;
  questions?: string[];
}

export const EXPLORATION_STORAGE_KEY = "campus-agora:explorations:v1";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isNonemptyText(value: unknown): value is string {
  return isText(value) && value.trim().length > 0;
}

function isDate(value: unknown): value is string {
  return isNonemptyText(value) && Number.isFinite(Date.parse(value));
}

function isWebUrl(value: unknown): value is string {
  if (!isNonemptyText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLookupUrl(value: unknown, sourceUrl: string): value is string {
  if (!isWebUrl(value)) return false;
  const url = new URL(value);
  const credentialKey =
    /(?:^|[_-])(?:token|auth|authorization|session|sessionid|password|credential|apikey|api_key)(?:$|[_-])/i;
  return (
    url.origin === new URL(sourceUrl).origin &&
    !url.username &&
    !url.password &&
    ![...url.searchParams.keys()].some((key) => credentialKey.test(key)) &&
    ![...new URLSearchParams(url.hash.slice(1)).keys()].some((key) =>
      credentialKey.test(key),
    )
  );
}

function isSource(value: unknown): value is SourceSnapshot {
  return (
    isObject(value) &&
    isWebUrl(value.url) &&
    (value.lookupUrl === undefined || isLookupUrl(value.lookupUrl, value.url)) &&
    (value.accessNote === undefined || isNonemptyText(value.accessNote)) &&
    isNonemptyText(value.title) &&
    isNonemptyText(value.content) &&
    isDate(value.collectedAt) &&
    (value.kind === undefined || value.kind === "snapshot" || value.kind === "live") &&
    (value.publishedAt === undefined || isNonemptyText(value.publishedAt)) &&
    (value.query === undefined || isText(value.query)) &&
    (value.relevanceEvidence === undefined ||
      (Array.isArray(value.relevanceEvidence) &&
        value.relevanceEvidence.every(isText))) &&
    (value.unknowns === undefined ||
      (Array.isArray(value.unknowns) && value.unknowns.every(isText))) &&
    (value.collection === undefined || isSourceCollection(value.collection))
  );
}

function isSourceCollection(value: unknown): value is SourceCollection {
  return (
    isObject(value) &&
    (value.method === "browser_dom" || value.method === "web_read") &&
    (value.contentKind === "summary" || value.contentKind === "body") &&
    (value.readStatus === "partial" || value.readStatus === "complete") &&
    isNonemptyText(value.scope) &&
    isNonemptyText(value.batchId)
  );
}

function isCandidate(value: unknown): value is CandidateSnapshot {
  return (
    isObject(value) &&
    isNonemptyText(value.candidateId) &&
    isNonemptyText(value.name) &&
    isNonemptyText(value.institution) &&
    isText(value.research) &&
    Array.isArray(value.sources) &&
    value.sources.every(isSource)
  );
}

function isTopicCandidate(value: unknown): value is TopicCandidate {
  return (
    isObject(value) &&
    isCandidate(value.candidate) &&
    isText(value.reason) &&
    Array.isArray(value.questions) &&
    value.questions.every(isText) &&
    isDate(value.savedAt)
  );
}

function hasUniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

function isTopic(value: unknown): value is ExplorationTopic {
  return (
    isObject(value) &&
    isNonemptyText(value.id) &&
    isNonemptyText(value.name) &&
    isText(value.question) &&
    isText(value.preferences) &&
    isDate(value.createdAt) &&
    isDate(value.updatedAt) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isTopicCandidate) &&
    hasUniqueIds(value.candidates.map((entry) => entry.candidate.candidateId))
  );
}

function isStoredExplorations(value: unknown): value is StoredExplorations {
  return (
    isObject(value) &&
    value.version === 1 &&
    Array.isArray(value.topics) &&
    value.topics.every(isTopic) &&
    hasUniqueIds(value.topics.map((topic) => topic.id))
  );
}

function cloneCandidate(candidate: CandidateSnapshot): CandidateSnapshot {
  return {
    candidateId: candidate.candidateId,
    name: candidate.name,
    institution: candidate.institution,
    research: candidate.research,
    sources: candidate.sources.map((source) => ({
      url: source.url,
      ...(source.lookupUrl !== undefined ? { lookupUrl: source.lookupUrl } : {}),
      ...(source.accessNote !== undefined ? { accessNote: source.accessNote } : {}),
      title: source.title,
      content: source.content,
      collectedAt: source.collectedAt,
      ...(source.kind !== undefined ? { kind: source.kind } : {}),
      ...(source.publishedAt !== undefined ? { publishedAt: source.publishedAt } : {}),
      ...(source.query !== undefined ? { query: source.query } : {}),
      ...(source.relevanceEvidence !== undefined
        ? { relevanceEvidence: [...source.relevanceEvidence] }
        : {}),
      ...(source.unknowns !== undefined ? { unknowns: [...source.unknowns] } : {}),
      ...(source.collection !== undefined
        ? {
            collection: {
              method: source.collection.method,
              contentKind: source.collection.contentKind,
              readStatus: source.collection.readStatus,
              scope: source.collection.scope,
              batchId: source.collection.batchId,
            },
          }
        : {}),
    })),
  };
}

function mergeSources(oldSources: SourceSnapshot[], newSources: SourceSnapshot[]) {
  const sources = new Map<string, SourceSnapshot>();
  for (const source of [...oldSources, ...newSources]) {
    const key = JSON.stringify([
      source.url,
      source.collectedAt,
      source.content,
      source.query,
      source.collection,
    ]);
    sources.set(key, { ...sources.get(key), ...source });
  }
  return [...sources.values()];
}

/**
 * Same-origin, same-browser storage only: no account, network transmission or sync.
 * Reads are fresh, and one setItem commits the whole update. Historical snapshots
 * remain usable; timestamps do not imply a currently open recruitment opportunity.
 */
export function createExplorationStore(
  storage: Pick<Storage, "getItem" | "setItem">,
  key = EXPLORATION_STORAGE_KEY,
) {
  function read(): StoredExplorations {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch (cause) {
      throw new ExplorationStoreError("read_failed", "无法读取此浏览器的探索记录。", {
        cause,
      });
    }
    if (raw === null) return { version: 1, topics: [] };

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (cause) {
      throw new ExplorationStoreError(
        "corrupted_data",
        "探索记录无法解析，原记录仍保留，未覆盖。",
        { cause },
      );
    }
    if (isObject(data) && data.version !== 1) {
      throw new ExplorationStoreError(
        "unsupported_version",
        "此探索记录版本暂不支持，原记录仍保留。",
      );
    }
    if (!isStoredExplorations(data)) {
      throw new ExplorationStoreError(
        "corrupted_data",
        "探索记录内容不完整或失效，原记录仍保留，未覆盖。",
      );
    }
    return data;
  }

  function write(data: StoredExplorations) {
    if (!isStoredExplorations(data)) {
      throw new ExplorationStoreError(
        "validation_failed",
        "请检查主题、来源和记录内容。",
      );
    }
    try {
      storage.setItem(key, JSON.stringify(data));
    } catch (cause) {
      throw new ExplorationStoreError(
        "write_failed",
        "保存未成功，请保留当前编辑内容后重试。",
        { cause },
      );
    }
  }

  function mutateTopic(
    id: string,
    change: (topic: ExplorationTopic) => void,
  ): ExplorationTopic {
    const data = read();
    const topic = data.topics.find((entry) => entry.id === id);
    if (!topic) {
      throw new ExplorationStoreError("not_found", "这个探索主题已不存在。");
    }
    change(topic);
    topic.updatedAt = new Date().toISOString();
    write(data);
    return topic;
  }

  return {
    listTopics(): ExplorationTopic[] {
      return read().topics;
    },
    getTopic(id: string): ExplorationTopic | undefined {
      return read().topics.find((topic) => topic.id === id);
    },
    createTopic(input: { name: string; question?: string; preferences?: string }) {
      const data = read();
      const now = new Date().toISOString();
      const topic: ExplorationTopic = {
        id: crypto.randomUUID(),
        name: input.name,
        question: input.question ?? "",
        preferences: input.preferences ?? "",
        createdAt: now,
        updatedAt: now,
        candidates: [],
      };
      data.topics.push(topic);
      write(data);
      return topic;
    },
    updateTopic(
      id: string,
      patch: Partial<Pick<ExplorationTopic, "name" | "question" | "preferences">>,
    ) {
      return mutateTopic(id, (topic) => {
        if (patch.name !== undefined) topic.name = patch.name;
        if (patch.question !== undefined) topic.question = patch.question;
        if (patch.preferences !== undefined) topic.preferences = patch.preferences;
      });
    },
    saveCandidate(
      topicId: string,
      candidate: CandidateSnapshot,
      privateRecord: PrivateRecordPatch = {},
    ) {
      if (!isCandidate(candidate)) {
        throw new ExplorationStoreError("validation_failed", "候选或来源内容不完整。");
      }
      return mutateTopic(topicId, (topic) => {
        const existing = topic.candidates.find(
          (entry) => entry.candidate.candidateId === candidate.candidateId,
        );
        const snapshot = cloneCandidate(candidate);
        if (existing) {
          snapshot.sources = mergeSources(existing.candidate.sources, snapshot.sources);
          existing.candidate = snapshot;
        } else {
          topic.candidates.push({
            candidate: snapshot,
            reason: privateRecord.reason ?? "",
            questions: [...(privateRecord.questions ?? [])],
            savedAt: new Date().toISOString(),
          });
        }
      });
    },
    updateCandidate(topicId: string, candidateId: string, patch: PrivateRecordPatch) {
      return mutateTopic(topicId, (topic) => {
        const entry = topic.candidates.find(
          (record) => record.candidate.candidateId === candidateId,
        );
        if (!entry) {
          throw new ExplorationStoreError("not_found", "此候选已不在这个主题里。");
        }
        if (patch.reason !== undefined) entry.reason = patch.reason;
        if (patch.questions !== undefined) entry.questions = [...patch.questions];
      });
    },
    removeCandidate(topicId: string, candidateId: string) {
      return mutateTopic(topicId, (topic) => {
        topic.candidates = topic.candidates.filter(
          (entry) => entry.candidate.candidateId !== candidateId,
        );
      });
    },
    deleteTopic(id: string) {
      const data = read();
      const remaining = data.topics.filter((topic) => topic.id !== id);
      if (remaining.length === data.topics.length) {
        throw new ExplorationStoreError("not_found", "这个探索主题已不存在。");
      }
      write({ version: 1, topics: remaining });
    },
  };
}
