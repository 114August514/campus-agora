// Comparison selection for this tab only. Removing from comparison never deletes saved records.
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "campus-agora.compare.v1";
const listeners = new Set<() => void>();
let selected: string[] = read();

function read(): string[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function commit(next: string[]): void {
  selected = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Selection still works in memory for this page.
  }
  for (const listener of listeners) listener();
}

export function useCompare(): string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selected,
  );
}

export function toggleCompare(id: string): void {
  commit(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
}

export function removeFromCompare(id: string): void {
  commit(selected.filter((x) => x !== id));
}
