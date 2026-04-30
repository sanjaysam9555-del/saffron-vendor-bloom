import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side middleware that attaches the current Supabase session's
 * bearer token to outgoing server function requests.
 */
export const attachAuthToken = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data, error } = await supabase.auth.getSession();
    let token = data.session?.access_token;

    if (!token && !error) {
      const refreshed = await supabase.auth.refreshSession();
      token = refreshed.data.session?.access_token;
    }

    if (!token) {
      throw new Error("Your session is still loading. Please try again in a moment.");
    }

    return next({
      headers: { Authorization: `Bearer ${token}` },
    });
  },
);
