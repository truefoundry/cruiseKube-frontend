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
  type StoredAuthSession,
} from "@/lib/auth-session";
import { isDemoMode } from "@/lib/demo-mode";
import { setResourcePricing } from "@/lib/pricing";

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

function initialAuthSession(): StoredAuthSession | null {
  if (isDemoMode) {
    const existing = readAuthSession();
    if (existing) return existing;
    return { username: "demo", basicToken: btoa("demo:demo") };
  }
  return readAuthSession();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [session, setSession] = useState(() => initialAuthSession());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!isDemoMode) return;
    setResourcePricing({
      cpuPerCorePerHour: 0.0145 * 2,
      memoryPerGbPerHour: 0.00724 * 2,
    });
  }, []);

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
          // Only disable auth on an explicit boolean false; otherwise keep the
          // fail-safe default (enabled). This prevents a missing or malformed
          // `auth_enabled` field (e.g. during a rolling upgrade with an older
          // backend) from accidentally bypassing authentication.
          setAuthEnabled(info.auth_enabled === false ? false : true);
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
