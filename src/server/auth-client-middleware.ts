import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

async function readToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

/**
 * Client-side middleware that attaches the current Supabase session's
 * bearer token to outgoing server function requests.
 *
 * Robust against the initial-load race where a request can fire before
 * the session has hydrated from storage:
 *   1. Try getSession() — fast path when session is already in memory.
 *   2. Try refreshSession() — recovers from an expired access token.
 *   3. Poll getSession() briefly (up to ~2s) — covers the initial
 *      hydration window after a hard reload.
 */
export const attachAuthToken = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token = await readToken();

    if (!token) {
      try {
        const refreshed = await supabase.auth.refreshSession();
        token = refreshed.data.session?.access_token;
      } catch {
        // ignore — fall through to polling
      }
    }

    if (!token) {
      for (let i = 0; i < 5 && !token; i++) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        token = await readToken();
      }
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
