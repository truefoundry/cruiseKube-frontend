import "./sentry.ts";
import { PostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isPostHogEnabled, posthogApiHost, posthogToken } from "./posthog-config";

if (isPostHogEnabled) {
  // `isPostHogEnabled` already implies demo mode (see posthog-config.ts), so any
  // event emitted from this client is from the demo site by definition.
  posthog.init(posthogToken, {
    api_host: posthogApiHost,
    // SPA pageviews are tracked in App.tsx on route changes.
    capture_pageview: true,
    session_recording: {
      // Avoid capturing sensitive input values by default.
      maskAllInputs: true,
    },
    defaults: "2026-01-30",
  });
  posthog.register({ source: "website", cruisekube_demo_mode: true });
}

const app = <App />;

createRoot(document.getElementById("root")!).render(
  isPostHogEnabled ? (
    <PostHogProvider client={posthog}>{app}</PostHogProvider>
  ) : (
    app
  ),
);
