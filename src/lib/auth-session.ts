const STORAGE_KEY = 'cruisekube-auth-session';

/** Session expires after 2 weeks (in milliseconds). */
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface StoredAuthSession {
  username: string;
  /** Base64 credential only (RFC 7617 payload after `Basic `). From login `token`. */
  basicToken: string;
}

/** Internal shape stored in localStorage (includes expiry metadata). */
interface PersistedSession {
  username: string;
  basicToken: string;
  /** Epoch-ms timestamp when the session was created. */
  createdAt: number;
}

function parseAuthSession(raw: string | null): StoredAuthSession | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (typeof parsed.username !== 'string' || !parsed.username.trim()) return null;
    if (typeof parsed.basicToken !== 'string' || !parsed.basicToken) return null;

    // Check expiration. Sessions without a createdAt (written by older code)
    // are treated as expired so the user re-authenticates with a fresh TTL.
    const createdAt = typeof parsed.createdAt === 'number' ? parsed.createdAt : 0;
    if (Date.now() - createdAt > SESSION_TTL_MS) {
      return null;
    }

    return { username: parsed.username.trim(), basicToken: parsed.basicToken };
  } catch {
    return null;
  }
}

export function readAuthSession(): StoredAuthSession | null {
  try {
    const session = parseAuthSession(localStorage.getItem(STORAGE_KEY));
    if (!session) {
      // Clean up expired/invalid entries.
      localStorage.removeItem(STORAGE_KEY);
    }
    return session;
  } catch {
    return null;
  }
}

export function writeAuthSession(session: StoredAuthSession): void {
  const persisted: PersistedSession = {
    username: session.username,
    basicToken: session.basicToken,
    createdAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
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
