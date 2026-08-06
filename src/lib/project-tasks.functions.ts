import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TaskPriority = "low" | "medium" | "high";

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  owner_name: string | null;
  due_date: string | null;
  priority: TaskPriority;
  done: boolean;
  sort_order: number;
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

export const listProjectTasks = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<ProjectTask[]> => {
    await assertCanRead(context.userId, data.project_id);
    const { data: rows, error } = await supabaseAdmin
      .from("project_tasks")
      .select("id, project_id, title, owner_name, due_date, priority, done, sort_order, updated_at")
      .eq("project_id", data.project_id)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ProjectTask[];
  });

export const createProjectTask = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        owner_name: z.string().trim().max(120).nullable().optional(),
        due_date: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);
    const { error } = await supabaseAdmin.from("project_tasks").insert({
      project_id: data.project_id,
      title: data.title,
      owner_name: data.owner_name || null,
      due_date: data.due_date || null,
      priority: data.priority,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProjectTask = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        owner_name: z.string().trim().max(120).nullable().optional(),
        due_date: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        done: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("project_tasks").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProjectTask = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);
    const { error } = await supabaseAdmin.from("project_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
