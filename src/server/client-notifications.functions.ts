import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireUser(): Promise<string> {
  const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) throw new Error("Authentication is still loading.");
  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData.user) throw new Error("Authentication is still loading.");
  return userData.user.id;
}

export const listMyClientNotifications = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const userId = await requireUser();
    const { data: rows, error } = await supabaseAdmin
      .from("client_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 30);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const markClientNotificationRead = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUser();
    const { error } = await supabaseAdmin
      .from("client_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllClientNotificationsRead = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .handler(async () => {
    const userId = await requireUser();
    const { error } = await supabaseAdmin
      .from("client_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
