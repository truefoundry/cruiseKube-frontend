const STORAGE_KEY = 'cruisekube-auth-session';

/** How long a login session remains valid without re-authenticating. */
export const AUTH_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks

export interface StoredAuthSession {
  username: string;
  /** Base64 credential only (RFC 7617 payload after `Basic `). From login `token`. */
  basicToken: string;
}

interface PersistedAuthSession extends StoredAuthSession {
  expiresAt: number;
}

export function readAuthSession(): StoredAuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      username?: string;
      basicToken?: string;
      expiresAt?: number;
    };
    if (typeof parsed.username !== 'string' || !parsed.username.trim()) return null;
    if (typeof parsed.basicToken !== 'string' || !parsed.basicToken) return null;
    if (typeof parsed.expiresAt === 'number' && Date.now() > parsed.expiresAt) {
      clearAuthSession();
      return null;
    }
    return { username: parsed.username.trim(), basicToken: parsed.basicToken };
  } catch {
    return null;
  }
}

export function writeAuthSession(session: StoredAuthSession): void {
  const payload: PersistedAuthSession = {
    ...session,
    expiresAt: Date.now() + AUTH_SESSION_TTL_MS,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearAuthSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Value for `Authorization` header, or null if not signed in. */
export function getBasicAuthorizationHeader(): string | null {
  const s = readAuthSession();
  if (!s?.basicToken) return null;
  return `Basic ${s.basicToken}`;
}
