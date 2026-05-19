import {
  useCallback,
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
import { OnboardingTourContext } from "./OnboardingTourContext";

// --- DOM target polling helper ---
function waitForElement(
  selector: string,
  signal?: AbortSignal,
  timeoutMs = 10000,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      resolve(true);
      return;
    }
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (signal?.aborted) {
        window.clearInterval(interval);
        resolve(false);
        return;
      }
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

  // Refs for stable callback access to render-time values (fixes #1, #5)
  const sidebarOpenRef = useRef(sidebarOpen);
  sidebarOpenRef.current = sidebarOpen;

  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  // AbortController for in-flight waitForElement polling (fixes #2)
  const waitAbortRef = useRef<AbortController | null>(null);
  // Guard against concurrent scheduleTourStart calls (fixes review #1)
  const startInFlightRef = useRef(false);

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
      startInFlightRef.current = false;
      // Abort any lingering waitForElement polling
      waitAbortRef.current?.abort();
      waitAbortRef.current = null;
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
      // Dedupe: if a start is already in-flight, bail out (fixes review #1)
      if (startInFlightRef.current) return;
      startInFlightRef.current = true;

      if (navigateFirst) {
        navigate("/");
      }

      // Save current sidebar state and force open (read from ref for freshness)
      sidebarStateBeforeTour.current = sidebarOpenRef.current;
      setSidebarOpen(true);

      // Abort any previous polling before starting a new one
      waitAbortRef.current?.abort();
      const abortController = new AbortController();
      waitAbortRef.current = abortController;

      // Wait for the first Overview target to appear in the DOM
      const found = await waitForElement(
        '[data-tour="overview-metrics"]',
        abortController.signal,
        10000,
      );

      if (found && locationRef.current === "/") {
        controls.start(0);
      } else {
        // Tour didn't start — restore sidebar and allow retry (fixes review #2)
        startInFlightRef.current = false;
        if (sidebarStateBeforeTour.current !== null) {
          setSidebarOpen(sidebarStateBeforeTour.current);
          sidebarStateBeforeTour.current = null;
        }
      }
    },
    [navigate, setSidebarOpen, controls],
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
    // Keep autoStartAttempted true to prevent the auto-start effect
    // from racing with this manual start (fixes review #1)
    autoStartAttempted.current = true;
    const needsNavigation = location.pathname !== "/";
    scheduleTourStart(needsNavigation);
  }, [location.pathname, scheduleTourStart]);

  // Cleanup on unmount: abort any in-flight polling (fixes #2)
  useEffect(() => {
    return () => {
      waitAbortRef.current?.abort();
    };
  }, []);

  return (
    <OnboardingTourContext.Provider value={{ startTour }}>
      {children}
      {Tour}
    </OnboardingTourContext.Provider>
  );
}
