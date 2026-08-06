import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TaskPriority = "P0" | "P1" | "P2" | "P3";

export type TaskStage =
  | "not_picked"
  | "in_progress"
  | "pending_client"
  | "pending_vendor"
  | "pending_planner"
  | "held_up"
  | "done";

export interface TaskVendorRef {
  vendor_id: string;
  vendor_name: string;
  category: string | null;
  quote_status: string | null;
  quote_amount: number | null;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  task_category: string | null;
  vendor_category: string | null;
  remarks: string | null;
  owner_name: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  priority: TaskPriority;
  stage: TaskStage;
  done: boolean;
  sort_order: number;
  preceding_task_id: string | null;
  succeeding_task_id: string | null;
  vendors: TaskVendorRef[];
  updated_at: string;
}

export interface TaskVendorOption {
  id: string;
  vendor_name: string;
  category: string | null;
  quote_status: string | null;
  quote_amount: number | null;
}

export interface TaskStaffOption {
  id: string;
  name: string;
}

const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
const STAGES = [
  "not_picked",
  "in_progress",
  "pending_client",
  "pending_vendor",
  "pending_planner",
  "held_up",
  "done",
] as const;

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

/** Latest / final quote per vendor for a project, keyed by vendor_id. */
async function quoteStatusByVendor(projectId: string) {
  const { data } = await supabaseAdmin
    .from("project_vendor_quotes")
    .select("vendor_id, status, is_final, closed_amount, quote_amount, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const map = new Map<string, { status: string; amount: number | null }>();
  for (const q of data ?? []) {
    const existing = map.get(q.vendor_id);
    const isClosed = q.is_final || q.status === "closed";
    if (!existing || isClosed) {
      map.set(q.vendor_id, {
        status: isClosed ? "closed" : q.status,
        amount: (q.closed_amount ?? q.quote_amount) as number | null,
      });
    }
  }
  return map;
}

async function replaceTaskVendors(taskId: string, vendorIds: string[]) {
  await supabaseAdmin.from("project_task_vendors").delete().eq("task_id", taskId);
  if (vendorIds.length === 0) return;
  const rows = vendorIds.map((vendor_id) => ({ task_id: taskId, vendor_id }));
  const { error } = await supabaseAdmin.from("project_task_vendors").insert(rows);
  if (error) throw new Error(error.message);
}

/** Keep the reciprocal side of a dependency in sync. */
async function syncDependencies(taskId: string, preceding: string | null, succeeding: string | null) {
  if (preceding) {
    await supabaseAdmin
      .from("project_tasks")
      .update({ succeeding_task_id: taskId })
      .eq("id", preceding)
      .is("succeeding_task_id", null);
  }
  if (succeeding) {
    await supabaseAdmin
      .from("project_tasks")
      .update({ preceding_task_id: taskId })
      .eq("id", succeeding)
      .is("preceding_task_id", null);
  }
}

const TASK_COLUMNS =
  "id, project_id, title, task_category, vendor_category, remarks, owner_name, assignee_user_id, due_date, priority, stage, done, sort_order, preceding_task_id, succeeding_task_id, updated_at";

export const listProjectTasks = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<ProjectTask[]> => {
    await assertCanRead(context.userId, data.project_id);
    const { data: rows, error } = await supabaseAdmin
      .from("project_tasks")
      .select(TASK_COLUMNS)
      .eq("project_id", data.project_id)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const tasks = (rows ?? []) as any[];
    if (tasks.length === 0) return [];

    const ids = tasks.map((t) => t.id);
    const [{ data: links }, quoteMap] = await Promise.all([
      supabaseAdmin.from("project_task_vendors").select("task_id, vendor_id").in("task_id", ids),
      quoteStatusByVendor(data.project_id),
    ]);

    const vendorIds = Array.from(new Set((links ?? []).map((l) => l.vendor_id)));
    const assigneeIds = Array.from(
      new Set(tasks.map((t) => t.assignee_user_id).filter(Boolean) as string[]),
    );

    const [{ data: vendors }, { data: profiles }] = await Promise.all([
      vendorIds.length
        ? supabaseAdmin.from("vendors").select("id, vendor_name, category").in("id", vendorIds)
        : Promise.resolve({ data: [] as any[] }),
      assigneeIds.length
        ? supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", assigneeIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const vendorMap = new Map((vendors ?? []).map((v: any) => [v.id, v]));
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));

    const byTask = new Map<string, TaskVendorRef[]>();
    for (const l of links ?? []) {
      const v = vendorMap.get(l.vendor_id);
      if (!v) continue;
      const q = quoteMap.get(l.vendor_id);
      const list = byTask.get(l.task_id) ?? [];
      list.push({
        vendor_id: v.id,
        vendor_name: v.vendor_name,
        category: v.category ?? null,
        quote_status: q?.status ?? null,
        quote_amount: q?.amount ?? null,
      });
      byTask.set(l.task_id, list);
    }

    return tasks.map((t) => ({
      ...t,
      assignee_name: t.assignee_user_id ? (nameMap.get(t.assignee_user_id) ?? null) : null,
      vendors: byTask.get(t.id) ?? [],
    })) as ProjectTask[];
  });

/** Dropdown data for the task card: project vendors (with quote status) + staff assignees. */
export const listTaskFormOptions = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);

    const [{ data: pv }, quoteMap, { data: roles }, { data: projects }] = await Promise.all([
      supabaseAdmin.from("project_vendors").select("vendor_id").eq("project_id", data.project_id),
      quoteStatusByVendor(data.project_id),
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "employee"]),
      supabaseAdmin
        .from("projects")
        .select("id, bride_name, groom_name, wedding_date")
        .is("archived_at", null)
        .order("wedding_date", { ascending: true }),
    ]);

    const vendorIds = (pv ?? []).map((r) => r.vendor_id);
    const { data: vendors } = vendorIds.length
      ? await supabaseAdmin.from("vendors").select("id, vendor_name, category").in("id", vendorIds)
      : { data: [] as any[] };

    const staffIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const { data: profiles } = staffIds.length
      ? await supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", staffIds)
      : { data: [] as any[] };

    const vendorOptions: TaskVendorOption[] = (vendors ?? [])
      .map((v: any) => {
        const q = quoteMap.get(v.id);
        return {
          id: v.id,
          vendor_name: v.vendor_name,
          category: v.category ?? null,
          quote_status: q?.status ?? null,
          quote_amount: q?.amount ?? null,
        };
      })
      .sort((a, b) => a.vendor_name.localeCompare(b.vendor_name));

    const staff: TaskStaffOption[] = (profiles ?? [])
      .map((p: any) => ({ id: p.user_id, name: p.display_name || "Team member" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      vendors: vendorOptions,
      staff,
      projects: (projects ?? []).map((p: any) => ({
        id: p.id,
        label: `${p.bride_name} & ${p.groom_name}`,
        wedding_date: p.wedding_date,
      })),
    };
  });

const taskInput = {
  title: z.string().trim().min(1).max(200),
  task_category: z.string().trim().max(120).nullable().optional(),
  vendor_category: z.string().trim().max(120).nullable().optional(),
  remarks: z.string().trim().max(2000).nullable().optional(),
  owner_name: z.string().trim().max(120).nullable().optional(),
  assignee_user_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).default("P2"),
  stage: z.enum(STAGES).default("not_picked"),
  preceding_task_id: z.string().uuid().nullable().optional(),
  succeeding_task_id: z.string().uuid().nullable().optional(),
  vendor_ids: z.array(z.string().uuid()).max(50).optional(),
};

export const createProjectTask = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid(), ...taskInput }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);
    const { vendor_ids = [], ...rest } = data;
    const { data: created, error } = await supabaseAdmin
      .from("project_tasks")
      .insert({
        project_id: rest.project_id,
        title: rest.title,
        task_category: rest.task_category || null,
        vendor_category: rest.vendor_category || null,
        remarks: rest.remarks || null,
        owner_name: rest.owner_name || null,
        assignee_user_id: rest.assignee_user_id || null,
        due_date: rest.due_date || null,
        priority: rest.priority,
        stage: rest.stage,
        done: rest.stage === "done",
        preceding_task_id: rest.preceding_task_id || null,
        succeeding_task_id: rest.succeeding_task_id || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await replaceTaskVendors(created.id, vendor_ids);
    await syncDependencies(created.id, rest.preceding_task_id || null, rest.succeeding_task_id || null);
    return { ok: true, id: created.id };
  });

export const updateProjectTask = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        task_category: z.string().trim().max(120).nullable().optional(),
        vendor_category: z.string().trim().max(120).nullable().optional(),
        remarks: z.string().trim().max(2000).nullable().optional(),
        owner_name: z.string().trim().max(120).nullable().optional(),
        assignee_user_id: z.string().uuid().nullable().optional(),
        due_date: z.string().nullable().optional(),
        priority: z.enum(PRIORITIES).optional(),
        stage: z.enum(STAGES).optional(),
        done: z.boolean().optional(),
        preceding_task_id: z.string().uuid().nullable().optional(),
        succeeding_task_id: z.string().uuid().nullable().optional(),
        vendor_ids: z.array(z.string().uuid()).max(50).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaffOnly(context.userId);
    const { id, vendor_ids, ...patch } = data;

    if (patch.preceding_task_id === id || patch.succeeding_task_id === id) {
      throw new Error("A task cannot depend on itself");
    }

    const update: Record<string, unknown> = { ...patch };
    if (patch.stage !== undefined) update.done = patch.stage === "done";
    else if (patch.done !== undefined) update.stage = patch.done ? "done" : "in_progress";

    if (Object.keys(update).length > 0) {
      const { error } = await supabaseAdmin.from("project_tasks").update(update).eq("id", id);
      if (error) throw new Error(error.message);
    }
    if (vendor_ids) await replaceTaskVendors(id, vendor_ids);
    await syncDependencies(id, patch.preceding_task_id ?? null, patch.succeeding_task_id ?? null);
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
