import { useEffect, useMemo, useRef } from "react";
import { useJoyride, STATUS } from "react-joyride";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { createTourSteps } from "./tourSteps";
import { TourTooltip } from "./TourTooltip";
import {
  markTourCompleted,
  getSavedSidebarState,
  clearSavedSidebarState,
} from "./tour-storage";

interface TourRunnerProps {
  tourTrigger: number;
}

/**
 * Heavy component that imports react-joyride and renders the tour overlay.
 * Lazy-loaded by OnboardingTourProvider — only downloaded when the tour
 * is actually triggered (first visit or retake).
 */
export function TourRunner({ tourTrigger }: TourRunnerProps) {
  const navigate = useNavigate();
  const { setOpen: setSidebarOpen } = useSidebar();

  const steps = useMemo(() => createTourSteps(navigate), [navigate]);

  const waitAbortRef = useRef<AbortController | null>(null);
  const lastProcessedTrigger = useRef(0);

  const { controls, on, state, Tour } = useJoyride({
    steps,
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
      const savedState = getSavedSidebarState();
      if (savedState !== null) {
        setSidebarOpen(savedState);
        clearSavedSidebarState();
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
      waitAbortRef.current?.abort();
      const abortController = new AbortController();
      waitAbortRef.current = abortController;

      // Step 1 targets body (centered welcome), so just a small delay for render
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (!abortController.signal.aborted) {
        controls.start(0);
      } else {
        // Tour didn't start — restore sidebar to pre-tour state
        const savedState = getSavedSidebarState();
        if (savedState !== null) {
          setSidebarOpen(savedState);
          clearSavedSidebarState();
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
