const STORAGE_KEY = 'cruisekube-auth-session';

export interface StoredAuthSession {
  username: string;
  /** Base64 credential only (RFC 7617 payload after `Basic `). From login `token`. */
  basicToken: string;
}

export function readAuthSession(): StoredAuthSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: string; basicToken?: string };
    if (typeof parsed.username !== 'string' || !parsed.username.trim()) return null;
    if (typeof parsed.basicToken !== 'string' || !parsed.basicToken) return null;
    return { username: parsed.username.trim(), basicToken: parsed.basicToken };
  } catch {
    return null;
  }
}

export function writeAuthSession(session: StoredAuthSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Value for `Authorization` header, or null if not signed in. */
export function getBasicAuthorizationHeader(): string | null {
  const s = readAuthSession();
  if (!s?.basicToken) return null;
  return `Basic ${s.basicToken}`;
}
