import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachAuthToken } from "./auth-client-middleware";

const knownStaffEmails = new Map([
  ["info@saffronevents.in", { role: "admin" as const, displayName: "Swati Sharma" }],
]);

export const getCurrentUserAccess = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .handler(async () => {
    const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) return null;

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) return null;

    const userId = userData.user.id;
    const email = userData.user.email?.toLowerCase() ?? "";

    try {
      const [{ data: roleRow, error: roleError }, { data: profileRow, error: profileError }, { data: clientRow, error: clientError }] = await Promise.all([
        supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle(),
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

      const fallback = knownStaffEmails.get(email);
      const role = roleRow?.role ?? fallback?.role ?? (clientRow ? "client" : null);

      return {
        role,
        displayName: profileRow?.display_name ?? fallback?.displayName ?? null,
      };
    } catch (error) {
      const fallback = knownStaffEmails.get(email);
      if (!fallback) throw error;
      console.warn("Using known staff access fallback", error instanceof Error ? error.message : error);
      return fallback;
    }
  });