// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Browser auth needs these public connection values at bundle time. Lovable
// normally injects them, but keeping the public URL and publishable key here
// also makes production builds resilient when that injection is unavailable.
// This is intentionally the RLS-scoped publishable key, never a service key.
const cloudUrl = "https://wkdddjhayxvtzctlxjii.supabase.co";
const cloudPublishableKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZGRkamhheXh2dHpjdGx4amlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mjk2OTgsImV4cCI6MjA5MzEwNTY5OH0.JQNfPCQr5dUd8TCPZHAGTmVDdGc1RNXqhFU6OH94dlY";

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(cloudUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(cloudPublishableKey),
    },
  },
});
