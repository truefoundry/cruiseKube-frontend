export const STORAGE_KEY = 'cruisekube-auth-session';

/**
 * localStorage key set on logout to prevent stale per-tab sessionStorage
 * tokens from being migrated back after the user has explicitly logged out.
 * The value is the epoch-ms timestamp of the logout.
 */
const LOGOUT_MARKER_KEY = 'cruisekube-auth-logged-out';

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    // Clear any previous logout marker since the user is now actively logging in.
    localStorage.removeItem(LOGOUT_MARKER_KEY);
  } catch (err) {
    // Log but do not swallow — callers (e.g. login flow) need to know the
    // session was not persisted so they can surface an error to the user.
    console.warn('writeAuthSession: failed to persist session', err);
    throw err;
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('clearAuthSession: failed to remove localStorage key', err);
  }
  // Prevent stale per-tab sessions from being migrated back after logout.
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('clearAuthSession: failed to remove sessionStorage key', err);
  }
  // Record a logout marker so that future migrations from sessionStorage
  // (e.g. a stale old-version tab that still has the per-tab token) are
  // blocked — see migrateSessionStorage().
  try {
    localStorage.setItem(LOGOUT_MARKER_KEY, String(Date.now()));
  } catch {
    // Best-effort; the marker is a defence-in-depth measure.
  }
}

/**
 * One-time migration: copy auth data from the legacy per-tab `sessionStorage`
 * key to `localStorage`. The migration is skipped when:
 *  - `sessionStorage` has no auth data, OR
 *  - `localStorage` already has auth data (no-clobber), OR
 *  - a logout marker exists in `localStorage` (the user explicitly logged out
 *    in a tab running the new code, so we must not resurrect a stale session
 *    from an old tab's `sessionStorage`).
 *
 * The `sessionStorage` key is always removed afterwards to prevent repeated
 * migration attempts.
 *
 * NOTE: This function is **not** auto-invoked at module load time. Call it
 * explicitly during app initialization (e.g. in `initialAuthSession()`).
 */
export function migrateSessionStorage(): void {
  try {
    const sessionRaw = sessionStorage.getItem(STORAGE_KEY);
    if (!sessionRaw) return;

    const localRaw = localStorage.getItem(STORAGE_KEY);
    const hasLogoutMarker = localStorage.getItem(LOGOUT_MARKER_KEY) !== null;

    if (!localRaw && !hasLogoutMarker) {
      localStorage.setItem(STORAGE_KEY, sessionRaw);
    }

    // Always remove legacy key to prevent resurrection after logout.
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort migration only.
  }
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
      // Design note: if another tab writes malformed data (e.g. via devtools
      // or a browser extension), `parseAuthSession` returns null and the
      // callback receives null — which the consumer treats as a logout. This
      // is intentional: we treat unparseable auth data the same as missing
      // auth data to avoid running with a potentially corrupted session.
      const parsed = parseAuthSession(event.newValue);
      if (parsed) {
        callback(parsed);
      } else {
        // Non-null newValue that failed to parse — treat as logout rather
        // than silently ignoring, since the auth key now holds garbage.
        callback(null);
      }
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
