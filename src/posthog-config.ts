import { isDemoMode } from "./lib/demo-mode";

/**
 * PostHog is on only when:
 *   - the flag is "true",
 *   - a project token is set (build-time Vite env), AND
 *   - the app is running in demo mode.
 * Self-hosted (non-demo) deployments must never send analytics to our PostHog project.
 */
const token = (import.meta.env.VITE_PUBLIC_POSTHOG_TOKEN ?? "").trim();

export const isPostHogEnabled =
  isDemoMode &&
  import.meta.env.VITE_POSTHOG_ENABLED === "true" &&
  token.length > 0;

export const posthogToken = token;

export const posthogApiHost =
  (import.meta.env.VITE_PUBLIC_POSTHOG_HOST ?? "").trim() ||
  "https://us.i.posthog.com";
