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
  * Keep this fast: auth gates and query `enabled` flags wait for session
  * hydration, so middleware should not add extra multi-second polling.
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

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
