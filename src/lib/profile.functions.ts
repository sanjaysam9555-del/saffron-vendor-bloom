import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface MyProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: "admin" | "employee" | "client" | null;
}

/**
 * The signed-in user's own profile. `setUserDisplayName` in
 * admin-users.functions is admin-only and takes a target user id; this is the
 * self-service equivalent and never accepts another user's id.
 */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const [{ data: profile }, { data: roles }, { data: userRes }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
      supabaseAdmin.auth.admin.getUserById(context.userId),
    ]);

    const rank = ["admin", "employee", "client"] as const;
    const role =
      rank.find((r) => (roles ?? []).some((x: any) => x.role === r)) ?? null;

    return {
      user_id: context.userId,
      email: userRes?.user?.email ?? null,
      display_name: profile?.display_name ?? null,
      role,
    };
  });

export const updateMyDisplayName = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ display_name: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    // Always scoped to the caller — the user id is never taken from input.
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.display_name, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
