const STORAGE_KEY = "campus-agora.session-token";

// Session tokens are short-lived and tab-scoped by policy:
// sessionStorage only, never localStorage. See docs/architecture/auth-permissions.md.
function storage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

let currentToken: string | undefined = storage()?.getItem(STORAGE_KEY) ?? undefined;

export function getSessionToken(): string | undefined {
  return currentToken;
}

export function setSessionToken(token: string | undefined): void {
  currentToken = token;

  const store = storage();
  if (!store) {
    return;
  }

  if (token) {
    store.setItem(STORAGE_KEY, token);
  } else {
    store.removeItem(STORAGE_KEY);
  }
}
