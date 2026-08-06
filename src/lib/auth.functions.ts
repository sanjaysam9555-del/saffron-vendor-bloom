import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";

/**
 * Resolves the signed-in user's role + display name.
 *
 * Uses the caller's own bearer token (RLS: users can read their own
 * role/profile/client link) instead of the service-role client, so a
 * rotated or mismatched service key can never lock everyone out of login.
 */
export const getCurrentUserAccess = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const userId = context.userId;
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();

    const [{ data: roleRows, error: roleError }, { data: profileRow, error: profileError }, { data: clientRow, error: clientError }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      supabase.from("project_clients").select("id").eq("user_id", userId).limit(1).maybeSingle(),
    ]);

    if (roleError) throw new Error(roleError.message);
    if (profileError) console.warn("Unable to load profile", profileError.message);
    if (clientError) console.warn("Unable to load client access", clientError.message);

    const roles = new Set((roleRows ?? []).map((r) => r.role));
    // Staff emails (saffronevents.in) prefer their staff role; everyone
    // else prefers the client role so the client portal opens.
    const isStaffEmail = email.endsWith("@saffronevents.in");
    let role: "admin" | "employee" | "client" | null = null;
    if (isStaffEmail) {
      if (roles.has("admin")) role = "admin";
      else if (roles.has("employee")) role = "employee";
      else if (roles.has("client")) role = "client";
    } else {
      if (roles.has("client") || clientRow) role = "client";
      else if (roles.has("admin")) role = "admin";
      else if (roles.has("employee")) role = "employee";
    }
    if (!role && clientRow) role = "client";

    return {
      role,
      displayName: profileRow?.display_name ?? null,
    };
  });
