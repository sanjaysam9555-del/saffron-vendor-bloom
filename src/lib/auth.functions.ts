import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachAuthToken } from "./auth-client-middleware";

export const getCurrentUserAccess = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .handler(async () => {
    const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) return null;

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) return null;

    const userId = userData.user.id;
    const email = userData.user.email?.toLowerCase() ?? "";

    const [{ data: roleRows, error: roleError }, { data: profileRow, error: profileError }, { data: clientRow, error: clientError }] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId),
      supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("project_clients")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
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