/** PostHog is on only when the flag is "true" and a project token is set (build-time Vite env). */
const token = (import.meta.env.VITE_PUBLIC_POSTHOG_TOKEN ?? "").trim();

export const isPostHogEnabled =
  import.meta.env.VITE_POSTHOG_ENABLED === "true" && token.length > 0;

export const posthogToken = token;

export const posthogApiHost =
  (import.meta.env.VITE_PUBLIC_POSTHOG_HOST ?? "").trim() ||
  "https://us.i.posthog.com";
