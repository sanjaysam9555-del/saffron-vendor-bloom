import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachAuthToken } from "./auth-client-middleware";

const knownStaffEmails = new Map([
  ["info@saffronevents.in", { role: "admin" as const, displayName: "Swati Sharma" }],
]);

export const getCurrentUserAccess = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = typeof context.claims.email === "string" ? context.claims.email.toLowerCase() : "";

    try {
      const [{ data: roleRow, error: roleError }, { data: profileRow, error: profileError }] = await Promise.all([
        supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", context.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("display_name")
          .eq("user_id", context.userId)
          .maybeSingle(),
      ]);

      if (roleError) throw new Error(roleError.message);
      if (profileError) console.warn("Unable to load profile", profileError.message);

      return {
        role: roleRow?.role ?? knownStaffEmails.get(email)?.role ?? "employee",
        displayName: profileRow?.display_name ?? knownStaffEmails.get(email)?.displayName ?? null,
      };
    } catch (error) {
      const fallback = knownStaffEmails.get(email);
      if (!fallback) throw error;
      console.warn("Using known staff access fallback", error instanceof Error ? error.message : error);
      return fallback;
    }
  });