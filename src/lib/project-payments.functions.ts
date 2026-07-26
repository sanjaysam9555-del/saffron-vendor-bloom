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

// -------------------- Payments matrix (one row per project) --------------------

export interface InstallmentSlot {
  id: string | null;
  installment_no: number;
  expected_amount: number;
  received_amount: number;
  received_on: string | null;
  status: PaymentStatus;
}

export interface PaymentMatrixRow {
  project_id: string;
  bride_name: string | null;
  groom_name: string | null;
  wedding_date: string | null;
  total_installments: number;
  planning_fee: number;
  total_received: number;
  payment_remarks: string | null;
  installments: InstallmentSlot[];
}

export const listPaymentsMatrix = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        from: z.string().nullable().optional(),
        to: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await context.supabase.rpc("admin_payments_matrix", {
      _from: (data.from ?? null) as unknown as string,
      _to: (data.to ?? null) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): PaymentMatrixRow => {
      const items = (Array.isArray(r.installments) ? r.installments : []) as any[];
      const slots: InstallmentSlot[] = [];
      const n = Math.max(1, Math.min(4, Number(r.total_installments ?? 1)));
      for (let i = 1; i <= n; i++) {
        const found = items.find((x) => Number(x.installment_no) === i);
        slots.push({
          id: found?.id ?? null,
          installment_no: i,
          expected_amount: Number(found?.expected_amount ?? 0),
          received_amount: Number(found?.received_amount ?? 0),
          received_on: found?.received_on ?? null,
          status: (found?.status ?? "pending") as PaymentStatus,
        });
      }
      return {
        project_id: r.project_id,
        bride_name: r.bride_name,
        groom_name: r.groom_name,
        wedding_date: r.wedding_date,
        total_installments: n,
        planning_fee: Number(r.planning_fee ?? 0),
        total_received: Number(r.total_received ?? 0),
        payment_remarks: r.payment_remarks ?? null,
        installments: slots,
      };
    });
  });

export const upsertInstallmentSlot = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        installment_no: z.number().int().min(1).max(4),
        expected_amount: z.number().nonnegative().optional(),
        received_amount: z.number().nonnegative().optional(),
        received_on: z.string().nullable().optional(),
        status: z.enum(["pending", "partial", "received", "overdue"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("project_payments")
      .select("id, expected_amount, received_amount, status, received_on")
      .eq("project_id", data.project_id)
      .eq("installment_no", data.installment_no)
      .maybeSingle();

    const patch: {
      expected_amount?: number;
      received_amount?: number;
      status?: PaymentStatus;
      received_on?: string | null;
    } = {};
    if (data.expected_amount !== undefined) patch.expected_amount = data.expected_amount;
    if (data.received_amount !== undefined) patch.received_amount = data.received_amount;
    if (data.status !== undefined) patch.status = data.status;
    if (data.received_on !== undefined) patch.received_on = data.received_on;

    if (existing) {
      const { error } = await supabaseAdmin
        .from("project_payments")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id as string };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("project_payments")
      .insert({
        project_id: data.project_id,
        installment_no: data.installment_no,
        label: `Installment ${data.installment_no}`,
        expected_amount: data.expected_amount ?? 0,
        received_amount: data.received_amount ?? 0,
        received_on: data.received_on ?? null,
        status: data.status ?? "pending",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const updateProjectPaymentRemarks = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        remarks: z.string().max(2000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("projects")
      .update({ payment_remarks: data.remarks ?? null })
      .eq("id", data.project_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProjectPlanningFee = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        planning_fee: z.number().nonnegative(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("projects")
      .update({ planning_fee: data.planning_fee })
      .eq("id", data.project_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


