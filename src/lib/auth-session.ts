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
}

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
