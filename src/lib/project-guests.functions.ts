import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RsvpStatus = "yes" | "no" | "maybe" | "pending";

export interface ProjectGuest {
  id: string;
  project_id: string;
  name: string;
  phone: string | null;
  side: "bride" | "groom" | null;
  category: string | null;
  plus_one: number;
  meal: string | null;
  rsvp_status: RsvpStatus;
  updated_at: string;
}

async function isStaff(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  return !!(data && data.length > 0);
}

async function hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("project_clients")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();
  return !!data;
}

async function assertCanRead(userId: string, projectId: string) {
  if (await isStaff(userId)) return;
  if (await hasProjectAccess(userId, projectId)) return;
  throw new Error("Forbidden");
}

async function assertStaffOnly(userId: string) {
  if (!(await isStaff(userId))) throw new Error("Forbidden: staff only");
}

export const listProjectGuests = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<ProjectGuest[]> => {
    await assertCanRead(context.userId, data.project_id);
    const { data: rows, error } = await supabaseAdmin
      .from("project_guests")
      .select("id, project_id, name, phone, side, category, plus_one, meal, rsvp_status, updated_at")
      .eq("project_id", data.project_id)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ProjectGuest[];
  });

export const createProjectGuest = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        phone: z.string().trim().max(20).nullable().optional(),
        side: z.enum(["bride", "groom"]).nullable().optional(),
        category: z.string().trim().max(60).nullable().optional(),
        plus_one: z.number().int().min(0).max(10).default(0),
        meal: z.string().trim().max(40).nullable().optional(),
        rsvp_status: z.enum(["yes", "no", "maybe", "pending"]).default("pending"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);
    const { error } = await supabaseAdmin.from("project_guests").insert({
      project_id: data.project_id,
      name: data.name,
      phone: data.phone || null,
      side: data.side || null,
      category: data.category || null,
      plus_one: data.plus_one,
      meal: data.meal || null,
      rsvp_status: data.rsvp_status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProjectGuest = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(160).optional(),
        phone: z.string().trim().max(20).nullable().optional(),
        side: z.enum(["bride", "groom"]).nullable().optional(),
        category: z.string().trim().max(60).nullable().optional(),
        plus_one: z.number().int().min(0).max(10).optional(),
        meal: z.string().trim().max(40).nullable().optional(),
        rsvp_status: z.enum(["yes", "no", "maybe", "pending"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("project_guests").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProjectGuest = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);
    const { error } = await supabaseAdmin.from("project_guests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
