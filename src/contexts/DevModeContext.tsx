import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const STORAGE_KEY = "cruisekube-verbose-dev-mode";

function readStored(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

interface DevModeContextType {
  /** When true, show verbose/dev-only UI (e.g. Workload Requested, Time range in Overview). */
  verboseMode: boolean;
  setVerboseMode: (enabled: boolean) => void;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [verboseMode, setVerboseModeState] = useState<boolean>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, verboseMode ? "1" : "0");
    } catch {
      // ignore
    }
  }, [verboseMode]);

  const setVerboseMode = useCallback((enabled: boolean) => {
    setVerboseModeState(enabled);
  }, []);

  return (
    <DevModeContext.Provider value={{ verboseMode, setVerboseMode }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode(): DevModeContextType {
  const ctx = useContext(DevModeContext);
  if (ctx === undefined) {
    throw new Error("useDevMode must be used within DevModeProvider");
  }
  return ctx;
}
