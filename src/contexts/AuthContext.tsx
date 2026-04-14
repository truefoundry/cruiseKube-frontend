import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { apiClient, type LoginRequest } from "@/lib/api";

const STORAGE_KEY = "cruisekube-auth-session";

function readStoredSession(): { token: string; userName: string | null } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; userName?: string | null };
    if (typeof parsed.token !== "string" || !parsed.token) return null;
    return { token: parsed.token, userName: parsed.userName ?? null };
  } catch {
    return null;
  }
}

interface AuthContextValue {
  token: string | null;
  userName: string | null;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredSession()?.token ?? null);
  const [userName, setUserName] = useState<string | null>(() => readStoredSession()?.userName ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const persistSession = useCallback((nextToken: string, nextUserName: string | null) => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: nextToken, userName: nextUserName })
    );
    setToken(nextToken);
    setUserName(nextUserName);
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      setIsSubmitting(true);
      try {
        const res = await apiClient.login(credentials);
        const name = res.user?.name ?? credentials.username;
        persistSession(res.token, name);
      } finally {
        setIsSubmitting(false);
      }
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUserName(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      userName,
      isAuthenticated: Boolean(token),
      isSubmitting,
      login,
      logout,
    }),
    [token, userName, isSubmitting, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
