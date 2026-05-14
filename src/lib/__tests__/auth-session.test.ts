import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  readAuthSession,
  writeAuthSession,
  clearAuthSession,
  migrateSessionStorage,
  subscribeAuthChange,
  getBasicAuthorizationHeader,
} from '../auth-session';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// STORAGE_KEY export
// ---------------------------------------------------------------------------
describe('STORAGE_KEY', () => {
  it('is the expected value used by all storage functions', () => {
    expect(STORAGE_KEY).toBe('cruisekube-auth-session');
  });
});

// ---------------------------------------------------------------------------
// readAuthSession (tests parseAuthSession indirectly)
// ---------------------------------------------------------------------------
describe('readAuthSession', () => {
  it('returns null when localStorage is empty', () => {
    expect(readAuthSession()).toBeNull();
  });

  it('returns stored session after writeAuthSession() writes it', () => {
    writeAuthSession({ username: 'admin', basicToken: 'dG9rZW4=' });
    expect(readAuthSession()).toEqual({ username: 'admin', basicToken: 'dG9rZW4=' });
  });

  it('returns null for malformed JSON in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(readAuthSession()).toBeNull();
  });

  it('returns null when username is empty string', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: '', basicToken: 'abc' }));
    expect(readAuthSession()).toBeNull();
  });

  it('returns null when username is missing from the stored object', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ basicToken: 'abc' }));
    expect(readAuthSession()).toBeNull();
  });

  it('returns null when basicToken is empty string', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: 'admin', basicToken: '' }));
    expect(readAuthSession()).toBeNull();
  });

  it('returns null when basicToken is missing from the stored object', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: 'admin' }));
    expect(readAuthSession()).toBeNull();
  });

  it('trims whitespace from username', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ username: '  admin  ', basicToken: 'abc' }),
    );
    const session = readAuthSession();
    expect(session).not.toBeNull();
    expect(session!.username).toBe('admin');
  });
});

// ---------------------------------------------------------------------------
// writeAuthSession / clearAuthSession
// ---------------------------------------------------------------------------
describe('writeAuthSession / clearAuthSession', () => {
  it('writeAuthSession() stores session in localStorage under the correct key', () => {
    writeAuthSession({ username: 'admin', basicToken: 'dG9rZW4=' });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ username: 'admin', basicToken: 'dG9rZW4=' });
  });

  it('writeAuthSession() clears the logout marker so future migration is allowed', () => {
    // Simulate a previous logout that set the marker.
    clearAuthSession();
    expect(localStorage.getItem('cruisekube-auth-logged-out')).not.toBeNull();

    writeAuthSession({ username: 'admin', basicToken: 'tok' });
    expect(localStorage.getItem('cruisekube-auth-logged-out')).toBeNull();
  });

  it('writeAuthSession() throws and logs when localStorage.setItem fails (e.g. quota exceeded)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() =>
      writeAuthSession({ username: 'admin', basicToken: 'tok' }),
    ).toThrow('QuotaExceededError');
    expect(warnSpy).toHaveBeenCalledWith(
      'writeAuthSession: failed to persist session',
      expect.any(DOMException),
    );
  });

  it('clearAuthSession() removes from localStorage', () => {
    writeAuthSession({ username: 'admin', basicToken: 'dG9rZW4=' });
    clearAuthSession();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clearAuthSession() also removes legacy sessionStorage key if present', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ username: 'admin', basicToken: 'tok' }));
    clearAuthSession();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clearAuthSession() sets a logout marker in localStorage', () => {
    clearAuthSession();
    const marker = localStorage.getItem('cruisekube-auth-logged-out');
    expect(marker).not.toBeNull();
    // Marker should be a numeric timestamp.
    expect(Number(marker)).toBeGreaterThan(0);
  });

  it('clearAuthSession() logs a warning when localStorage.removeItem throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    // Should not throw — errors are caught and logged.
    clearAuthSession();
    expect(warnSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// migrateSessionStorage
// ---------------------------------------------------------------------------
describe('migrateSessionStorage', () => {
  it('copies from sessionStorage to localStorage when localStorage is empty', () => {
    const data = JSON.stringify({ username: 'admin', basicToken: 'tok' });
    sessionStorage.setItem(STORAGE_KEY, data);
    migrateSessionStorage();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(data);
  });

  it('does NOT overwrite localStorage if it already has a session', () => {
    const existing = JSON.stringify({ username: 'existing', basicToken: 'abc' });
    const incoming = JSON.stringify({ username: 'incoming', basicToken: 'xyz' });
    localStorage.setItem(STORAGE_KEY, existing);
    sessionStorage.setItem(STORAGE_KEY, incoming);
    migrateSessionStorage();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(existing);
  });

  it('always removes the key from sessionStorage after migration', () => {
    const existing = JSON.stringify({ username: 'existing', basicToken: 'abc' });
    const incoming = JSON.stringify({ username: 'incoming', basicToken: 'xyz' });
    localStorage.setItem(STORAGE_KEY, existing);
    sessionStorage.setItem(STORAGE_KEY, incoming);
    migrateSessionStorage();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('no-op when sessionStorage is empty', () => {
    migrateSessionStorage();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does NOT migrate when a logout marker exists (prevents session resurrection)', () => {
    // Simulate: user logged out on a tab running new code, which sets the
    // marker. Then an old tab refreshes and triggers migration with its stale
    // sessionStorage token.
    const staleSession = JSON.stringify({ username: 'stale', basicToken: 'old-token' });
    sessionStorage.setItem(STORAGE_KEY, staleSession);
    localStorage.setItem('cruisekube-auth-logged-out', String(Date.now()));

    migrateSessionStorage();

    // The stale session must NOT be copied to localStorage.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    // But the sessionStorage key is still cleaned up.
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// subscribeAuthChange
// ---------------------------------------------------------------------------
describe('subscribeAuthChange', () => {
  it('calls callback with parsed session when localStorage changes with the correct key', () => {
    const callback = vi.fn();
    const unsub = subscribeAuthChange(callback);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify({ username: 'admin', basicToken: 'dG9rZW4=' }),
        storageArea: localStorage,
      }),
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ username: 'admin', basicToken: 'dG9rZW4=' });

    unsub();
  });

  it('calls callback with null when key is removed (event.newValue is null)', () => {
    const callback = vi.fn();
    const unsub = subscribeAuthChange(callback);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: null,
        storageArea: localStorage,
      }),
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);

    unsub();
  });

  it('calls callback with null when newValue is malformed JSON (treats corruption as logout)', () => {
    const callback = vi.fn();
    const unsub = subscribeAuthChange(callback);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: '{not valid json',
        storageArea: localStorage,
      }),
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);

    unsub();
  });

  it('does not call callback for unrelated localStorage keys', () => {
    const callback = vi.fn();
    const unsub = subscribeAuthChange(callback);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'some-other-key',
        newValue: 'some-value',
        storageArea: localStorage,
      }),
    );

    expect(callback).not.toHaveBeenCalled();

    unsub();
  });

  it('does not call callback for sessionStorage events', () => {
    const callback = vi.fn();
    const unsub = subscribeAuthChange(callback);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify({ username: 'admin', basicToken: 'dG9rZW4=' }),
        storageArea: sessionStorage,
      }),
    );

    expect(callback).not.toHaveBeenCalled();

    unsub();
  });

  it('calls callback with null when event.key is null (localStorage.clear())', () => {
    const callback = vi.fn();
    const unsub = subscribeAuthChange(callback);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: null,
        newValue: null,
        storageArea: localStorage,
      }),
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);

    unsub();
  });

  it('returns an unsubscribe function that removes the listener', () => {
    const callback = vi.fn();
    const unsub = subscribeAuthChange(callback);
    unsub();

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify({ username: 'admin', basicToken: 'dG9rZW4=' }),
        storageArea: localStorage,
      }),
    );

    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getBasicAuthorizationHeader
// ---------------------------------------------------------------------------
describe('getBasicAuthorizationHeader', () => {
  it('returns "Basic <token>" when session exists', () => {
    writeAuthSession({ username: 'admin', basicToken: 'dG9rZW4=' });
    expect(getBasicAuthorizationHeader()).toBe('Basic dG9rZW4=');
  });

  it('returns null when no session exists', () => {
    expect(getBasicAuthorizationHeader()).toBeNull();
  });
});
