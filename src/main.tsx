import "./sentry.ts";
import { PostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isPostHogEnabled, posthogApiHost, posthogToken } from "./posthog-config";

const PERSON_ID_STORAGE_KEY = "cruisekube_person_id";

/**
 * Stable, browser-local identifier for the demo visitor. Persisted under our own
 * localStorage key so the same browser keeps the same PostHog `distinct_id` across
 * tabs, sessions, and even after PostHog's own cookies/localStorage are cleared.
 */
function getOrCreatePersonId(): string {
  try {
    const existing = window.localStorage.getItem(PERSON_ID_STORAGE_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PERSON_ID_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / disabled storage: fall back to a transient ID for this page load.
    return `ck-ephemeral-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

if (isPostHogEnabled) {
  // `isPostHogEnabled` already implies demo mode (see posthog-config.ts), so any
  // event emitted from this client is from the demo site by definition.
  const personId = getOrCreatePersonId();
  posthog.init(posthogToken, {
    api_host: posthogApiHost,
    // Seed PostHog's distinct_id with the cached browser-local ID so the same
    // visitor is recognised across sessions.
    bootstrap: { distinctID: personId },
    // SPA pageviews are tracked in App.tsx on route changes.
    capture_pageview: true,
    session_recording: {
      // Avoid capturing sensitive input values by default.
      maskAllInputs: true,
    },
    defaults: "2026-01-30",
  });
  posthog.register({ source: "demo-website", cruisekube_demo_mode: true });
}

const app = <App />;

createRoot(document.getElementById("root")!).render(
  isPostHogEnabled ? (
    <PostHogProvider client={posthog}>{app}</PostHogProvider>
  ) : (
    app
  ),
);
