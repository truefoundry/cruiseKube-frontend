import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
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

  // Shared state: when set to a positive number, the TourRunner starts the tour
  const [tourTrigger, setTourTrigger] = useState(0);

  // Manual retake from sidebar
  const startTour = useCallback(() => {
    clearTourCompleted();
    if (!isMobile) {
      // Persist sidebar state to localStorage before forcing it open
      saveSidebarState(sidebarOpen);
      setSidebarOpen(true);
      if (location.pathname !== "/") {
        navigate("/");
      }
      // Increment trigger to signal TourRunner to start
      setTourTrigger((prev) => prev + 1);
    }
  }, [isMobile, sidebarOpen, location.pathname, navigate, setSidebarOpen]);

  // Auto-start for first-time visitors (desktop, on /, not completed)
  const autoStartAttempted = useRef(false);
  useEffect(() => {
    if (
      !isMobile &&
      !autoStartAttempted.current &&
      !isTourCompleted() &&
      location.pathname === "/"
    ) {
      autoStartAttempted.current = true;
      // Persist sidebar state to localStorage before forcing it open
      saveSidebarState(sidebarOpen);
      setSidebarOpen(true);
      setTourTrigger((prev) => prev + 1);
    }
  }, [isMobile, sidebarOpen, location.pathname, setSidebarOpen]);

  return (
    <OnboardingTourContext.Provider value={{ startTour }}>
      {children}
      <LazyTourRunner tourTrigger={tourTrigger} />
    </OnboardingTourContext.Provider>
  );
}

// --- Lazy-loaded TourRunner ---
import { lazy, Suspense } from "react";

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
