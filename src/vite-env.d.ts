/// <reference types="vite/client" />

interface ImportMetaEnv {

  readonly VITE_POSTHOG_ENABLED?: string;
  readonly VITE_PUBLIC_POSTHOG_TOKEN?: string;
  readonly VITE_PUBLIC_POSTHOG_HOST?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
