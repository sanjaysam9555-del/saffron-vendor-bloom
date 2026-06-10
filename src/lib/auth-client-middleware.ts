import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/** Refresh proactively when the access token has < this many seconds left. */
const REFRESH_SKEW_SECONDS = 60;

function decodeExp(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    // base64url -> base64
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const json = JSON.parse(atob(padded)) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

async function readToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

/**
 * Client-side middleware that attaches the current Supabase session's
 * bearer token to outgoing server function requests.
 *
 * If the token is missing or about to expire, refresh it first so the
 * request doesn't go out with a dead JWT (which then surfaces as a
 * confusing "Authentication is still loading" error and, on mobile,
 * sometimes leads users to think they were signed out).
 */
export const attachAuthToken = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token = await readToken();

    let needsRefresh = !token;
    if (token) {
      const exp = decodeExp(token);
      const nowSec = Math.floor(Date.now() / 1000);
      if (exp !== null && exp - nowSec <= REFRESH_SKEW_SECONDS) {
        needsRefresh = true;
      }
    }

    if (needsRefresh) {
      try {
        const refreshed = await supabase.auth.refreshSession();
        token = refreshed.data.session?.access_token ?? token;
      } catch {
        // ignore — request goes out with whatever we have; server will
        // respond with a retryable error if the token truly is dead.
      }
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
