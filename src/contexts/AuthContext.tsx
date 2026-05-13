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
      clearAuthSession();
      setSession(null);
      queryClient.clear();
      navigate("/login", { replace: true });
    });
    return () => setApiUnauthorizedHandler(null);
  }, [navigate, queryClient]);

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
      isAuthenticated: Boolean(session?.basicToken),
      isSubmitting,
      login,
      logout,
    }),
    [session, isSubmitting, login, logout]
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
