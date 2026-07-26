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

export type CommissionPaymentStatus = "pending" | "partial" | "received" | "overdue";

export interface CommissionInstallmentSlot {
  id: string | null;
  installment_no: number;
  expected_amount: number;
  received_amount: number;
  received_on: string | null;
  status: CommissionPaymentStatus;
}

export interface CommissionMatrixRow {
  quote_id: string;
  vendor_id: string;
  vendor_name: string;
  category: string | null;
  closed_amount: number;
  commission_amount: number;
  total_installments: number;
  commission_remarks: string | null;
  total_received: number;
  installments: CommissionInstallmentSlot[];
}

const ProjectIdInput = z.object({ project_id: z.string().uuid() });

// -- Overview / P&L / Matrix -------------------------------------------------

export const projectAnalyticsOverview = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => ProjectIdInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await context.supabase.rpc(
      "admin_project_analytics_overview",
      { _project_id: data.project_id },
    );
    if (error) throw new Error(error.message);
    return (rows?.[0] ?? { client_billing: 0, vendor_cost: 0, commission: 0 }) as {
      client_billing: number;
      vendor_cost: number;
      commission: number;
    };
  });

export const projectReceivedBreakdown = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => ProjectIdInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: ppRows, error: e1 } = await context.supabase
      .from("project_payments")
      .select("received_amount")
      .eq("project_id", data.project_id);
    if (e1) throw new Error(e1.message);
    const { data: vcRows, error: e2 } = await context.supabase
      .from("vendor_commission_payments")
      .select("received_amount")
      .eq("project_id", data.project_id);
    if (e2) throw new Error(e2.message);
    const fee_received = (ppRows ?? []).reduce((a: number, r: any) => a + Number(r.received_amount ?? 0), 0);
    const commission_received = (vcRows ?? []).reduce((a: number, r: any) => a + Number(r.received_amount ?? 0), 0);
    return { fee_received, commission_received, total: fee_received + commission_received };
  });

export const projectPnl = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => ProjectIdInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await context.supabase.rpc("admin_project_pnl", {
      _project_id: data.project_id,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      quote_id: string;
      vendor_id: string;
      vendor_name: string;
      category: string | null;
      client_billing: number;
      vendor_cost: number;
      commission: number;
    }>;
  });

export const listCommissionMatrix = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => ProjectIdInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await context.supabase.rpc(
      "admin_project_commission_matrix",
      { _project_id: data.project_id },
    );
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): CommissionMatrixRow => {
      const items = (Array.isArray(r.installments) ? r.installments : []) as any[];
      const n = Math.max(1, Math.min(4, Number(r.total_installments ?? 2)));
      const slots: CommissionInstallmentSlot[] = [];
      for (let i = 1; i <= n; i++) {
        const found = items.find((x) => Number(x.installment_no) === i);
        slots.push({
          id: found?.id ?? null,
          installment_no: i,
          expected_amount: Number(found?.expected_amount ?? 0),
          received_amount: Number(found?.received_amount ?? 0),
          received_on: found?.received_on ?? null,
          status: (found?.status ?? "pending") as CommissionPaymentStatus,
        });
      }
      return {
        quote_id: r.quote_id,
        vendor_id: r.vendor_id,
        vendor_name: r.vendor_name,
        category: r.category,
        closed_amount: Number(r.closed_amount ?? 0),
        commission_amount: Number(r.commission_amount ?? 0),
        total_installments: n,
        commission_remarks: r.commission_remarks ?? null,
        total_received: Number(r.total_received ?? 0),
        installments: slots,
      };
    });
  });

// -- Mutations ---------------------------------------------------------------

export const upsertCommissionInstallment = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quote_id: z.string().uuid(),
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
    // Fetch quote to get project_id + vendor_id
    const { data: quote, error: qErr } = await supabaseAdmin
      .from("project_vendor_quotes")
      .select("id, project_id, vendor_id")
      .eq("id", data.quote_id)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!quote) throw new Error("Quote not found");

    const { data: existing } = await supabaseAdmin
      .from("vendor_commission_payments")
      .select("id")
      .eq("quote_id", data.quote_id)
      .eq("installment_no", data.installment_no)
      .maybeSingle();

    const patch: {
      expected_amount?: number;
      received_amount?: number;
      status?: CommissionPaymentStatus;
      received_on?: string | null;
    } = {};
    if (data.expected_amount !== undefined) patch.expected_amount = data.expected_amount;
    if (data.received_amount !== undefined) patch.received_amount = data.received_amount;
    if (data.status !== undefined) patch.status = data.status;
    if (data.received_on !== undefined) patch.received_on = data.received_on;

    if (existing) {
      const { error } = await supabaseAdmin
        .from("vendor_commission_payments")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id as string };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("vendor_commission_payments")
      .insert({
        project_id: quote.project_id,
        quote_id: data.quote_id,
        vendor_id: quote.vendor_id,
        installment_no: data.installment_no,
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

export const updateQuoteCommissionInstallmentCount = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quote_id: z.string().uuid(),
        total_installments: z.number().int().min(1).max(2),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("project_vendor_quotes")
      .update({ total_commission_installments: data.total_installments })
      .eq("id", data.quote_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateQuoteCommissionRemarks = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quote_id: z.string().uuid(),
        remarks: z.string().max(2000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("project_vendor_quotes")
      .update({ commission_remarks: data.remarks ?? null })
      .eq("id", data.quote_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
