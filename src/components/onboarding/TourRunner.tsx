import { useEffect, useRef } from "react";
import { useJoyride, STATUS } from "react-joyride";
import { useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { tourSteps } from "./tourSteps";
import { TourTooltip } from "./TourTooltip";
import { markTourCompleted } from "./tour-storage";

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

interface TourRunnerProps {
  tourTrigger: number;
}

/**
 * Heavy component that imports react-joyride and renders the tour overlay.
 * Lazy-loaded by OnboardingTourProvider — only downloaded when the tour
 * is actually triggered (first visit or retake).
 */
export function TourRunner({ tourTrigger }: TourRunnerProps) {
  const location = useLocation();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();

  const sidebarOpenRef = useRef(sidebarOpen);
  sidebarOpenRef.current = sidebarOpen;

  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  const sidebarStateBeforeTour = useRef<boolean | null>(null);
  const waitAbortRef = useRef<AbortController | null>(null);
  const lastProcessedTrigger = useRef(0);

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

  // Listen for tour end to persist completion and restore sidebar state
  useEffect(() => {
    const unsubscribe = on("tour:end", () => {
      markTourCompleted();
      waitAbortRef.current?.abort();
      waitAbortRef.current = null;
      if (sidebarStateBeforeTour.current !== null) {
        setSidebarOpen(sidebarStateBeforeTour.current);
        sidebarStateBeforeTour.current = null;
      }
    });
    return unsubscribe;
  }, [on, setSidebarOpen]);

  // Start the tour when tourTrigger changes
  useEffect(() => {
    if (tourTrigger <= lastProcessedTrigger.current) return;
    if (state.status !== STATUS.READY && state.status !== STATUS.FINISHED && state.status !== STATUS.SKIPPED) return;

    lastProcessedTrigger.current = tourTrigger;

    const startTour = async () => {
      sidebarStateBeforeTour.current = sidebarOpenRef.current;
      setSidebarOpen(true);

      waitAbortRef.current?.abort();
      const abortController = new AbortController();
      waitAbortRef.current = abortController;

      const found = await waitForElement(
        '[data-tour="overview-metrics"]',
        abortController.signal,
        10000,
      );

      if (found && locationRef.current === "/") {
        controls.start(0);
      } else {
        // Tour didn't start — restore sidebar
        if (sidebarStateBeforeTour.current !== null) {
          setSidebarOpen(sidebarStateBeforeTour.current);
          sidebarStateBeforeTour.current = null;
        }
      }
    };

    startTour();
  }, [tourTrigger, state.status, controls, setSidebarOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      waitAbortRef.current?.abort();
    };
  }, []);

  return <>{Tour}</>;
}
