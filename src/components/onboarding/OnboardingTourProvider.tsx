import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { isDemoMode } from "@/lib/demo-mode";
import {
  isTourCompleted,
  clearTourCompleted,
  saveSidebarState,
} from "./tour-storage";
import { OnboardingTourContext } from "./OnboardingTourContext";

/**
 * Lightweight provider that renders children immediately and lazy-loads
 * the heavy react-joyride tour runner as a non-blocking sibling.
 * This avoids a blank page while the tour chunk downloads.
 */
export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const isMobile = useIsMobile();

  // Track sidebar state in a ref so we always capture the latest value
  // without stale closures or dependency-array issues.
  const sidebarOpenRef = useRef(sidebarOpen);
  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  // Shared state: when set to a positive number, the TourRunner starts the tour
  const [tourTrigger, setTourTrigger] = useState(0);

  // Manual start from sidebar "Take tour"
  const startTour = useCallback(() => {
    if (isMobile) return;
    clearTourCompleted();
    // Persist sidebar state to localStorage before forcing it open
    saveSidebarState(sidebarOpenRef.current);
    setSidebarOpen(true);
    if (location.pathname !== "/") {
      navigate("/");
    }
    // Increment trigger to signal TourRunner to start
    setTourTrigger((prev) => prev + 1);
  }, [isMobile, location.pathname, navigate, setSidebarOpen]);

  // Auto-start for first-time visitors (desktop, on /, not completed)
  const autoStartAttempted = useRef(false);
  // Capture the initial sidebar state on mount for auto-start
  const initialSidebarOpen = useRef(sidebarOpen);
  useEffect(() => {
    if (
      isDemoMode &&
      !isMobile &&
      !autoStartAttempted.current &&
      !isTourCompleted() &&
      location.pathname === "/"
    ) {
      autoStartAttempted.current = true;
      // Persist sidebar state to localStorage before forcing it open
      saveSidebarState(initialSidebarOpen.current);
      setSidebarOpen(true);
      setTourTrigger((prev) => prev + 1);
    }
  }, [isMobile, location.pathname, setSidebarOpen]);

  return (
    <OnboardingTourContext.Provider value={{ startTour, isMobile }}>
      {children}
      <LazyTourRunner tourTrigger={tourTrigger} />
    </OnboardingTourContext.Provider>
  );
}

// --- Lazy-loaded TourRunner ---

const TourRunnerImpl = lazy(() =>
  import("./TourRunner").then((m) => ({ default: m.TourRunner })),
);

function LazyTourRunner({
  tourTrigger,
}: {
  tourTrigger: number;
}) {
  // Don't even load the chunk until the tour is triggered
  if (tourTrigger === 0) return null;
  return (
    <Suspense fallback={null}>
      <TourRunnerImpl tourTrigger={tourTrigger} />
    </Suspense>
  );
}
