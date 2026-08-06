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
      .select("expected_amount, received_amount")
      .eq("project_id", data.project_id);
    if (e1) throw new Error(e1.message);
    const { data: vcRows, error: e2 } = await context.supabase
      .from("vendor_commission_payments")
      .select("expected_amount, received_amount")
      .eq("project_id", data.project_id);
    if (e2) throw new Error(e2.message);
    const fee_received = (ppRows ?? []).reduce((a: number, r: any) => a + Number(r.received_amount ?? 0), 0);
    const commission_received = (vcRows ?? []).reduce((a: number, r: any) => a + Number(r.received_amount ?? 0), 0);
    const fee_pending = (ppRows ?? []).reduce((a: number, r: any) => a + Math.max(Number(r.expected_amount ?? 0) - Number(r.received_amount ?? 0), 0), 0);
    const commission_pending = (vcRows ?? []).reduce((a: number, r: any) => a + Math.max(Number(r.expected_amount ?? 0) - Number(r.received_amount ?? 0), 0), 0);
    return {
      fee_received,
      commission_received,
      total: fee_received + commission_received,
      fee_pending,
      commission_pending,
      pending_total: fee_pending + commission_pending,
    };
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

// -- Vendor Payment Matrix ---------------------------------------------------

export type VendorPaymentStatus = "pending" | "partial" | "paid" | "overdue";
export type VendorPaymentPaidBy = "planner" | "client";

export interface VendorPaymentInstallmentSlot {
  id: string | null;
  installment_no: number;
  expected_amount: number;
  paid_amount: number;
  paid_on: string | null;
  status: VendorPaymentStatus;
  paid_by: VendorPaymentPaidBy;
}

export interface VendorPaymentMatrixRow {
  quote_id: string;
  vendor_id: string;
  vendor_name: string;
  category: string | null;
  vendor_cost: number;
  total_installments: number;
  payment_remarks: string | null;
  total_paid: number;
  installments: VendorPaymentInstallmentSlot[];
}

export const listVendorPaymentMatrix = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => ProjectIdInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await context.supabase.rpc(
      "admin_project_vendor_payment_matrix",
      { _project_id: data.project_id },
    );
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): VendorPaymentMatrixRow => {
      const items = (Array.isArray(r.installments) ? r.installments : []) as any[];
      const n = Math.max(1, Math.min(4, Number(r.total_installments ?? 1)));
      const slots: VendorPaymentInstallmentSlot[] = [];
      for (let i = 1; i <= n; i++) {
        const found = items.find((x) => Number(x.installment_no) === i);
        slots.push({
          id: found?.id ?? null,
          installment_no: i,
          expected_amount: Number(found?.expected_amount ?? 0),
          paid_amount: Number(found?.paid_amount ?? 0),
          paid_on: found?.paid_on ?? null,
          status: (found?.status ?? "pending") as VendorPaymentStatus,
          paid_by: (found?.paid_by ?? "planner") as VendorPaymentPaidBy,
        });
      }
      return {
        quote_id: r.quote_id,
        vendor_id: r.vendor_id,
        vendor_name: r.vendor_name,
        category: r.category,
        vendor_cost: Number(r.vendor_cost ?? 0),
        total_installments: n,
        payment_remarks: r.payment_remarks ?? null,
        total_paid: Number(r.total_paid ?? 0),
        installments: slots,
      };
    });
  });

export const upsertVendorPaymentInstallment = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quote_id: z.string().uuid(),
        installment_no: z.number().int().min(1).max(4),
        expected_amount: z.number().nonnegative().optional(),
        paid_amount: z.number().nonnegative().optional(),
        paid_on: z.string().nullable().optional(),
        status: z.enum(["pending", "partial", "paid", "overdue"]).optional(),
        paid_by: z.enum(["planner", "client"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: quote, error: qErr } = await supabaseAdmin
      .from("project_vendor_quotes")
      .select("id, project_id, vendor_id")
      .eq("id", data.quote_id)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!quote) throw new Error("Quote not found");

    const { data: existing } = await supabaseAdmin
      .from("vendor_payment_installments")
      .select("id")
      .eq("quote_id", data.quote_id)
      .eq("installment_no", data.installment_no)
      .maybeSingle();

    const patch: {
      expected_amount?: number;
      paid_amount?: number;
      status?: VendorPaymentStatus;
      paid_on?: string | null;
      paid_by?: VendorPaymentPaidBy;
    } = {};
    if (data.expected_amount !== undefined) patch.expected_amount = data.expected_amount;
    if (data.paid_amount !== undefined) patch.paid_amount = data.paid_amount;
    if (data.status !== undefined) patch.status = data.status;
    if (data.paid_on !== undefined) patch.paid_on = data.paid_on;
    if (data.paid_by !== undefined) patch.paid_by = data.paid_by;

    if (existing) {
      const { error } = await supabaseAdmin
        .from("vendor_payment_installments")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id as string };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("vendor_payment_installments")
      .insert({
        project_id: quote.project_id,
        quote_id: data.quote_id,
        vendor_id: quote.vendor_id,
        installment_no: data.installment_no,
        expected_amount: data.expected_amount ?? 0,
        paid_amount: data.paid_amount ?? 0,
        paid_on: data.paid_on ?? null,
        status: data.status ?? "pending",
        paid_by: data.paid_by ?? "planner",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const updateQuoteVendorPaymentInstallmentCount = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quote_id: z.string().uuid(),
        total_installments: z.number().int().min(1).max(4),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("project_vendor_quotes")
      .update({ total_vendor_payment_installments: data.total_installments })
      .eq("id", data.quote_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateQuoteVendorPaymentRemarks = createServerFn({ method: "POST" })
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
      .update({ vendor_payment_remarks: data.remarks ?? null })
      .eq("id", data.quote_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
