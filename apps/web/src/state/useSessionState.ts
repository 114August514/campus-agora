// Keeps lightweight UI state (search text, filters) across page switches in this tab.
import { useEffect, useState } from "react";

export function useSessionState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Works in memory only.
    }
  }, [key, value]);
  return [value, setValue];
}
