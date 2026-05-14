import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readAuthSession,
  writeAuthSession,
  clearAuthSession,
  migrateSessionStorage,
  subscribeAuthChange,
  getBasicAuthorizationHeader,
} from '../auth-session';

const STORAGE_KEY = 'cruisekube-auth-session';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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
  it('writeAuthSession() stores session in localStorage under key cruisekube-auth-session', () => {
    writeAuthSession({ username: 'admin', basicToken: 'dG9rZW4=' });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ username: 'admin', basicToken: 'dG9rZW4=' });
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
