import { beforeEach, describe, expect, test } from "bun:test";

class MemoryStorage {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }
}

function installWindow(): {
  sessionStorage: MemoryStorage;
  localStorage: MemoryStorage;
} {
  const sessionStorage = new MemoryStorage();
  const localStorage = new MemoryStorage();

  (globalThis as { window?: unknown }).window = { sessionStorage, localStorage };

  return { sessionStorage, localStorage };
}

/**
 * Session tokens are tab-scoped by policy: sessionStorage only, never
 * localStorage. See docs/architecture/auth-permissions.md. Without this test
 * nothing in `bun run ci:frontend` would catch a regression that swapped one
 * for the other.
 */
describe("session token storage", () => {
  let storages: ReturnType<typeof installWindow>;
  let store: typeof import("../src/features/auth/session");

  beforeEach(async () => {
    storages = installWindow();
    // Imported after the window stub so the module reads the fresh storage.
    store = await import(`../src/features/auth/session?t=${Math.random()}`);
  });

  test("writes the token to sessionStorage and never to localStorage", () => {
    store.setSessionToken("token-abc");

    expect(store.getSessionToken()).toBe("token-abc");
    expect(storages.sessionStorage.getItem("campus-agora.session-token")).toBe(
      "token-abc",
    );
    expect(storages.localStorage.size).toBe(0);
  });

  test("clearing the token removes it from storage", () => {
    store.setSessionToken("token-abc");
    store.setSessionToken(undefined);

    expect(store.getSessionToken()).toBeUndefined();
    expect(storages.sessionStorage.size).toBe(0);
    expect(storages.localStorage.size).toBe(0);
  });

  test("reads an existing token back on load", async () => {
    storages.sessionStorage.setItem("campus-agora.session-token", "restored");

    const reloaded = await import(`../src/features/auth/session?t=${Math.random()}`);

    expect(reloaded.getSessionToken()).toBe("restored");
  });
});
