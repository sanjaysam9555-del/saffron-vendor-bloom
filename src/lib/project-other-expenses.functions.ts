import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";

export interface OtherExpense {
  id: string;
  project_id: string;
  label: string;
  planned_amount: number | null;
  actual_amount: number | null;
  notes: string | null;
  sort_order: number;
  criticality: "low" | "medium" | "high";
  booked: boolean;
  due_date: string | null;
  updated_at: string;
}

async function isStaff(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  return !!(data && data.length > 0);
}

async function isAdmin(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("project_clients")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();
  return !!data;
}

export const listProjectOtherExpenses = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const staff = await isStaff(context.userId);
    if (!staff) {
      const access = await hasProjectAccess(context.userId, data.project_id);
      if (!access) throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cols = staff
      ? "id, project_id, label, planned_amount, actual_amount, notes, sort_order, criticality, booked, updated_at"
      : "id, project_id, label, planned_amount, actual_amount, sort_order, criticality, booked, updated_at";
    const { data: rows, error } = await supabaseAdmin
      .from("project_other_expenses")
      .select(cols as string)
      .eq("project_id", data.project_id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as unknown as OtherExpense[];
    return staff ? list : list.map((r) => ({ ...r, notes: null }));
  });

export const upsertProjectOtherExpense = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        project_id: z.string().uuid(),
        label: z.string().trim().min(1).max(120),
        planned_amount: z.number().min(0).max(1_000_000_000).nullable(),
        actual_amount: z.number().min(0).max(1_000_000_000).nullable(),
        notes: z.string().max(1000).nullable().optional(),
        sort_order: z.number().int().min(0).max(10_000).optional(),
        criticality: z.enum(["low", "medium", "high"]).optional(),
        booked: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (!(await isStaff(context.userId))) throw new Error("Forbidden: staff only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("project_other_expenses")
        .update({
          label: data.label,
          planned_amount: data.planned_amount,
          actual_amount: data.actual_amount,
          notes: data.notes ?? null,
          sort_order: data.sort_order ?? 0,
          criticality: data.criticality ?? "medium",
          booked: data.booked ?? true,
        })
        .eq("id", data.id)
        .eq("project_id", data.project_id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("project_other_expenses")
      .insert({
        project_id: data.project_id,
        label: data.label,
        planned_amount: data.planned_amount,
        actual_amount: data.actual_amount,
        notes: data.notes ?? null,
        sort_order: data.sort_order ?? 0,
        criticality: data.criticality ?? "medium",
        booked: data.booked ?? true,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins.id as string };
  });

export const deleteProjectOtherExpense = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Forbidden: admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("project_other_expenses")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
