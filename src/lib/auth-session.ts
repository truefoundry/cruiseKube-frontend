const STORAGE_KEY = 'cruisekube-auth-session';

export interface StoredAuthSession {
  username: string;
  /** Base64 credential only (RFC 7617 payload after `Basic `). From login `token`. */
  basicToken: string;
}

function parseAuthSession(raw: string | null): StoredAuthSession | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: string; basicToken?: string };
    if (typeof parsed.username !== 'string' || !parsed.username.trim()) return null;
    if (typeof parsed.basicToken !== 'string' || !parsed.basicToken) return null;
    return { username: parsed.username.trim(), basicToken: parsed.basicToken };
  } catch {
    return null;
  }
}

export function readAuthSession(): StoredAuthSession | null {
  try {
    return parseAuthSession(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeAuthSession(session: StoredAuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
  // Prevent stale per-tab sessions from being migrated back after logout.
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
}

export function migrateSessionStorage(): void {
  try {
    const sessionRaw = sessionStorage.getItem(STORAGE_KEY);
    if (!sessionRaw) return;
    const localRaw = localStorage.getItem(STORAGE_KEY);
    if (!localRaw) {
      localStorage.setItem(STORAGE_KEY, sessionRaw);
    }
    // Always remove legacy key to prevent resurrection after logout.
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort migration only.
  }
}

migrateSessionStorage();

export function subscribeAuthChange(
  callback: (session: StoredAuthSession | null) => void
): () => void {
  const handler = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (event.key === null || !event.newValue) {
      callback(null);
    } else {
      callback(parseAuthSession(event.newValue));
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** Value for `Authorization` header, or null if not signed in. */
export function getBasicAuthorizationHeader(): string | null {
  const s = readAuthSession();
  if (!s?.basicToken) return null;
  return `Basic ${s.basicToken}`;
}
