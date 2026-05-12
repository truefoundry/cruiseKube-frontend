import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, setApiUnauthorizedHandler, type LoginRequest } from "@/lib/api";
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} from "@/lib/auth-session";

interface AuthContextValue {
  username: string | null;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  authEnabled: boolean;
  authLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [session, setSession] = useState(() => readAuthSession());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  const logout = useCallback(() => {
    clearAuthSession();
    setSession(null);
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  useEffect(() => {
    setApiUnauthorizedHandler(() => {
      if (!authEnabled) return;
      clearAuthSession();
      setSession(null);
      queryClient.clear();
      navigate("/login", { replace: true });
    });
    return () => setApiUnauthorizedHandler(null);
  }, [authEnabled, navigate, queryClient]);

  useEffect(() => {
    let cancelled = false;
    apiClient.getAuthInfo()
      .then((info) => {
        if (!cancelled) {
          setAuthEnabled(info.auth_enabled);
        }
      })
      .catch(() => {
        // On error, default to auth enabled (fail-safe: show login)
      })
      .finally(() => {
        if (!cancelled) {
          setAuthLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    setIsSubmitting(true);
    try {
      const res = await apiClient.login(credentials);
      if (typeof res.token !== "string" || !res.token) {
        throw new Error("Invalid login response");
      }
      const username = credentials.username.trim();
      const next = { username, basicToken: res.token };
      writeAuthSession(next);
      setSession(next);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      username: session?.username ?? null,
      isAuthenticated: !authEnabled || Boolean(session?.basicToken),
      isSubmitting,
      authEnabled,
      authLoading,
      login,
      logout,
    }),
    [session, isSubmitting, login, logout, authEnabled, authLoading]
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
