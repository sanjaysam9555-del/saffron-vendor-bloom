import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachAuthToken } from "./auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireStaff(context: { supabase: any; userId: string }): Promise<{ userId: string }> {
  const { data: roles, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", ["admin", "employee"]);
  if (error) throw new Error(error.message);
  if (!roles || roles.length === 0) throw new Error("Forbidden: staff only");
  return { userId: context.userId };
}

export const listStaffNotifications = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const limit = data.limit ?? 30;
    const { data: rows, error } = await supabaseAdmin
      .from("staff_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    // Resolve project names in one extra query so clubbed rows can name the
    // wedding they belong to ("8 client status changes · Sharma & Iyer").
    const ids = [...new Set((rows ?? []).map((r: any) => r.project_id).filter(Boolean))];
    let nameOf = new Map<string, string>();
    if (ids.length > 0) {
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("id, bride_name, groom_name")
        .in("id", ids as string[]);
      nameOf = new Map(
        (projects ?? []).map((p: any) => [
          p.id as string,
          `${p.bride_name ?? "?"} & ${p.groom_name ?? "?"}`,
        ]),
      );
    }

    return (rows ?? []).map((r: any) => ({
      ...r,
      project_name: r.project_id ? nameOf.get(r.project_id) ?? null : null,
    }));
  });

export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    let userId: string;
    try {
      ({ userId } = await requireStaff(context));
    } catch {
      // Session not hydrated yet (or non-staff): no badge, no crash.
      return { count: 0 };
    }
    // Count rows where read_by does NOT have a key for this user.
    const { data, error } = await supabaseAdmin
      .from("staff_notifications")
      .select("id, read_by")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const unread = (data ?? []).filter((r: any) => !r.read_by || !r.read_by[userId]).length;
    return { count: unread };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = await requireStaff(context);
    const { data: row, error: readErr } = await supabaseAdmin
      .from("staff_notifications")
      .select("read_by")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const next = { ...((row?.read_by as Record<string, string> | null) ?? {}), [userId]: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from("staff_notifications")
      .update({ read_by: next })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = await requireStaff(context);
    const { data: rows, error: readErr } = await supabaseAdmin
      .from("staff_notifications")
      .select("id, read_by")
      .order("created_at", { ascending: false })
      .limit(500);
    if (readErr) throw new Error(readErr.message);
    const stamp = new Date().toISOString();
    const updates = (rows ?? []).filter((r: any) => !r.read_by || !r.read_by[userId]);
    for (const r of updates) {
      const next = { ...((r.read_by as Record<string, string> | null) ?? {}), [userId]: stamp };
      await supabaseAdmin.from("staff_notifications").update({ read_by: next }).eq("id", r.id);
    }
    return { ok: true, updated: updates.length };
  });
