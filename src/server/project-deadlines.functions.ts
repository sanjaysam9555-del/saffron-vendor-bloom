import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Criticality = "low" | "medium" | "high";

export interface CategoryDeadline {
  id: string;
  project_id: string;
  category: string;
  due_date: string | null;
  criticality: Criticality;
  notes: string | null;
  planned_amount: number | null;
  actual_amount_override: number | null;
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

async function assertStaffOnly(userId: string) {
  if (!(await isStaff(userId))) throw new Error("Forbidden: staff only");
}

async function assertCanRead(userId: string, projectId: string) {
  if (await isStaff(userId)) return;
  if (await hasProjectAccess(userId, projectId)) return;
  throw new Error("Forbidden");
}

export const listProjectCategoryDeadlines = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertCanRead(context.userId, data.project_id);
    const { data: rows, error } = await supabaseAdmin
      .from("project_category_deadlines")
      .select("id, project_id, category, due_date, criticality, notes, planned_amount, actual_amount_override, updated_at")
      .eq("project_id", data.project_id);
    if (error) throw new Error(error.message);
    return (rows ?? []) as CategoryDeadline[];
  });

export const upsertCategoryDeadline = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        category: z.string().min(1).max(120),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        criticality: z.enum(["low", "medium", "high"]),
        notes: z.string().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);
    const { error } = await supabaseAdmin
      .from("project_category_deadlines")
      .upsert(
        {
          project_id: data.project_id,
          category: data.category,
          due_date: data.due_date,
          criticality: data.criticality,
          notes: data.notes ?? null,
          created_by: context.userId,
        },
        { onConflict: "project_id,category" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategoryDeadline = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ project_id: z.string().uuid(), category: z.string().min(1) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: adminRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!adminRow) throw new Error("Forbidden: admin only");
    const { error } = await supabaseAdmin
      .from("project_category_deadlines")
      .delete()
      .eq("project_id", data.project_id)
      .eq("category", data.category);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
