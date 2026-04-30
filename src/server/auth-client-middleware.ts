import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side middleware that attaches the current Supabase session's
 * bearer token to outgoing server function requests.
 */
export const attachAuthToken = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
