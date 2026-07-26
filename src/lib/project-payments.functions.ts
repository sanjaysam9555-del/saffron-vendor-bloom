import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export type PaymentStatus = "pending" | "partial" | "received" | "overdue";
export interface ProjectPayment {
  id: string;
  project_id: string;
  label: string;
  expected_amount: number;
  received_amount: number;
  due_date: string | null;
  received_on: string | null;
  status: PaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const listProjectPayments = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("project_payments")
      .select("*")
      .eq("project_id", data.project_id)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ProjectPayment[];
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  label: z.string().min(1),
  expected_amount: z.number().nonnegative(),
  received_amount: z.number().nonnegative().default(0),
  due_date: z.string().nullable().optional(),
  received_on: z.string().nullable().optional(),
  status: z.enum(["pending", "partial", "received", "overdue"]),
  notes: z.string().nullable().optional(),
});

export const upsertProjectPayment = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => UpsertInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const payload = {
      project_id: data.project_id,
      label: data.label,
      expected_amount: data.expected_amount,
      received_amount: data.received_amount,
      due_date: data.due_date ?? null,
      received_on: data.received_on ?? null,
      status: data.status,
      notes: data.notes ?? null,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("project_payments")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("project_payments")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deleteProjectPayment = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("project_payments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// List all projects (id + names) for the admin ledger picker
export const listAdminProjectsMini = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("id, bride_name, groom_name, wedding_date")
      .order("wedding_date", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      bride_name: string | null;
      groom_name: string | null;
      wedding_date: string | null;
    }>;
  });
