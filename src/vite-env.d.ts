/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_ENABLED?: string;
  readonly VITE_PUBLIC_POSTHOG_TOKEN?: string;
  readonly VITE_PUBLIC_POSTHOG_HOST?: string;
}
