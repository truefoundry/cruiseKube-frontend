import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useJoyride, STATUS } from "react-joyride";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { tourSteps } from "./tourSteps";
import { TourTooltip } from "./TourTooltip";
import {
  isTourCompleted,
  markTourCompleted,
  clearTourCompleted,
} from "./tour-storage";

// --- DOM target polling helper ---
function waitForElement(
  selector: string,
  timeoutMs = 10000,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      resolve(true);
      return;
    }
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (document.querySelector(selector)) {
        window.clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(interval);
        resolve(false);
      }
    }, 200);
  });
}

// --- Context ---
interface OnboardingTourContextType {
  startTour: () => void;
}

const OnboardingTourContext = createContext<OnboardingTourContextType>({
  startTour: () => {},
});

export function useOnboardingTour() {
  return useContext(OnboardingTourContext);
}

// --- Provider ---
export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const isMobile = useIsMobile();

  // Track whether auto-start has already been attempted this session
  const autoStartAttempted = useRef(false);
  // Save sidebar state before tour to restore after
  const sidebarStateBeforeTour = useRef<boolean | null>(null);

  const { controls, on, state, Tour } = useJoyride({
    steps: tourSteps,
    continuous: true,
    tooltipComponent: TourTooltip,
    locale: {
      back: "Back",
      close: "Got it",
      last: "Finish",
      next: "Next",
      skip: "Skip tour",
    },
    options: {
      zIndex: 10000,
      showProgress: true,
      overlayClickAction: false,
      targetWaitTimeout: 3000,
      skipBeacon: true,
    },
  });

  // Listen for tour end (finished or skipped) to persist completion
  // and restore sidebar state
  useEffect(() => {
    const unsubscribe = on("tour:end", () => {
      markTourCompleted();
      // Restore sidebar to its previous state
      if (sidebarStateBeforeTour.current !== null) {
        setSidebarOpen(sidebarStateBeforeTour.current);
        sidebarStateBeforeTour.current = null;
      }
    });
    return unsubscribe;
  }, [on, setSidebarOpen]);

  // Centralized tour start: navigate to /, open sidebar, wait for target, start
  const scheduleTourStart = useCallback(
    async (navigateFirst: boolean) => {
      if (navigateFirst) {
        navigate("/");
      }
      // Save current sidebar state and force open
      sidebarStateBeforeTour.current = sidebarOpen;
      setSidebarOpen(true);
      // Wait for the first Overview target to appear in the DOM
      const found = await waitForElement(
        '[data-tour="overview-metrics"]',
        10000,
      );
      if (found) {
        controls.start(0);
      }
    },
    [navigate, sidebarOpen, setSidebarOpen, controls],
  );

  // Auto-start tour for first-time visitors on the Overview page (desktop only)
  useEffect(() => {
    if (
      !isMobile &&
      !autoStartAttempted.current &&
      !isTourCompleted() &&
      location.pathname === "/" &&
      state.status === STATUS.READY
    ) {
      autoStartAttempted.current = true;
      scheduleTourStart(false);
    }
  }, [isMobile, location.pathname, state.status, scheduleTourStart]);

  // Manual retake from sidebar
  const startTour = useCallback(() => {
    clearTourCompleted();
    autoStartAttempted.current = false;
    const needsNavigation = location.pathname !== "/";
    scheduleTourStart(needsNavigation);
  }, [location.pathname, scheduleTourStart]);

  return (
    <OnboardingTourContext.Provider value={{ startTour }}>
      {children}
      {Tour}
    </OnboardingTourContext.Provider>
  );
}
