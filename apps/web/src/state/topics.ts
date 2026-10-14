// Exploration topics: private records stored only in this browser (localStorage).
// Reasons belong to a (topic, item) record, never to the public advisor or
// opportunity object, so editing or deleting topic A never touches topic B.
import { useSyncExternalStore } from "react";
import type { ItemRef } from "../data/types";

export interface TopicEntry {
  item: ItemRef;
  reason: string;
  questions: string[];
  savedAt: string;
}

export interface Topic {
  id: string;
  title: string;
  question: string;
  createdAt: string;
  entries: TopicEntry[];
}

const STORAGE_KEY = "campus-agora.topics.v1";
const listeners = new Set<() => void>();
let storageAvailable = true;
let topics: Topic[] = read();

/** Records saved before opportunities existed stored `advisorId` directly. */
function migrateEntry(raw: TopicEntry & { advisorId?: string }): TopicEntry {
  if (raw.item) return raw;
  const { advisorId, ...rest } = raw;
  return { ...rest, item: { kind: "advisor", id: advisorId ?? "" } };
}

function read(): Topic[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Topic[]) : [];
    return parsed.map((t) => ({ ...t, entries: t.entries.map(migrateEntry) }));
  } catch {
    storageAvailable = false;
    return [];
  }
}

function commit(next: Topic[]): void {
  topics = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTopics(): Topic[] {
  return useSyncExternalStore(subscribe, () => topics);
}

export function isStorageAvailable(): boolean {
  return storageAvailable;
}

export function sameItem(a: ItemRef, b: ItemRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function findEntry(
  topic: Topic | undefined,
  item: ItemRef,
): TopicEntry | undefined {
  return topic?.entries.find((e) => sameItem(e.item, item));
}

function newId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createTopic(title: string, question = ""): Topic {
  const topic: Topic = {
    id: newId(),
    title: title.trim(),
    question: question.trim(),
    createdAt: new Date().toISOString(),
    entries: [],
  };
  commit([...topics, topic]);
  return topic;
}

export function updateTopic(
  id: string,
  patch: Partial<Pick<Topic, "title" | "question">>,
): void {
  commit(topics.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function deleteTopic(id: string): void {
  commit(topics.filter((t) => t.id !== id));
}

/** Save or update this item inside one topic only. */
export function saveEntry(topicId: string, item: ItemRef, reason: string): void {
  commit(
    topics.map((t) => {
      if (t.id !== topicId) return t;
      const existing = findEntry(t, item);
      const entry: TopicEntry = existing
        ? { ...existing, reason }
        : { item, reason, questions: [], savedAt: new Date().toISOString() };
      return {
        ...t,
        entries: existing
          ? t.entries.map((e) => (sameItem(e.item, item) ? entry : e))
          : [...t.entries, entry],
      };
    }),
  );
}

export function updateEntry(
  topicId: string,
  item: ItemRef,
  patch: Partial<TopicEntry>,
): void {
  commit(
    topics.map((t) =>
      t.id === topicId
        ? {
            ...t,
            entries: t.entries.map((e) =>
              sameItem(e.item, item) ? { ...e, ...patch } : e,
            ),
          }
        : t,
    ),
  );
}

export function removeEntry(topicId: string, item: ItemRef): void {
  commit(
    topics.map((t) =>
      t.id === topicId
        ? { ...t, entries: t.entries.filter((e) => !sameItem(e.item, item)) }
        : t,
    ),
  );
}
