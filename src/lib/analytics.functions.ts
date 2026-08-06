import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";

export const analyticsOverview = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().nullable().optional(), to: z.string().nullable().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: roleRow, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) throw new Error("Forbidden: admin only");
    const { data: rows, error } = await context.supabase.rpc("admin_analytics_overview", {
      _from: (data.from ?? null) as unknown as string,
      _to: (data.to ?? null) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return (rows?.[0] ?? {
      client_billing: 0,
      vendor_cost: 0,
      commission: 0,
      received: 0,
      pending: 0,
      project_count: 0,
      booked_vendor_count: 0,
    }) as {
      client_billing: number;
      vendor_cost: number;
      commission: number;
      received: number;
      pending: number;
      project_count: number;
      booked_vendor_count: number;
    };
  });

export const analyticsReceivedBreakdown = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().nullable().optional(), to: z.string().nullable().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: roleRow, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) throw new Error("Forbidden: admin only");

    let pp = context.supabase.from("project_payments").select("received_amount, received_on");
    if (data.from) pp = pp.gte("received_on", data.from);
    if (data.to) pp = pp.lte("received_on", data.to);
    let vc = context.supabase.from("vendor_commission_payments").select("received_amount, received_on");
    if (data.from) vc = vc.gte("received_on", data.from);
    if (data.to) vc = vc.lte("received_on", data.to);

    // Run all 4 queries in parallel — each was a sequential await before,
    // adding 150-300ms per round trip. Now they complete in one batch.
    const [
      { data: ppRows, error: e1 },
      { data: vcRows, error: e2 },
      { data: paymentRows, error: e3 },
      { data: vcAll, error: e4 },
    ] = await Promise.all([
      pp,
      vc,
      // Fee pending must match the Payments Matrix: use planning_fee as the
      // baseline when installment expected totals are lower/incomplete.
      context.supabase.rpc("admin_payments_matrix", {
        _from: (data.from ?? null) as unknown as string,
        _to: (data.to ?? null) as unknown as string,
      }),
      context.supabase.from("vendor_commission_payments").select("expected_amount, received_amount"),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (e3) throw new Error(e3.message);
    if (e4) throw new Error(e4.message);
    const fee_received = (ppRows ?? []).reduce((a: number, r: any) => a + Number(r.received_amount ?? 0), 0);
    const commission_received = (vcRows ?? []).reduce((a: number, r: any) => a + Number(r.received_amount ?? 0), 0);
    const fee_pending = (paymentRows ?? []).reduce((a: number, r: any) => {
      const installments = Array.isArray(r.installments) ? r.installments : [];
      const expectedTotal = installments.reduce((sum: number, s: any) => sum + Number(s.expected_amount ?? 0), 0);
      const basis = Math.max(Number(r.planning_fee ?? 0), expectedTotal);
      return a + Math.max(basis - Number(r.total_received ?? 0), 0);
    }, 0);
    const commission_pending = (vcAll ?? []).reduce((a: number, r: any) => a + Math.max(Number(r.expected_amount ?? 0) - Number(r.received_amount ?? 0), 0), 0);
    return {
      fee_received,
      commission_received,
      total: fee_received + commission_received,
      fee_pending,
      commission_pending,
      pending_total: fee_pending + commission_pending,
    };
  });

export const analyticsProjects = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().nullable().optional(), to: z.string().nullable().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: roleRow, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) throw new Error("Forbidden: admin only");
    const { data: rows, error } = await context.supabase.rpc("admin_analytics_projects", {
      _from: (data.from ?? null) as unknown as string,
      _to: (data.to ?? null) as unknown as string,
    });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      project_id: string;
      bride_name: string | null;
      groom_name: string | null;
      wedding_date: string | null;
      client_billing: number;
      vendor_cost: number;
      commission: number;
      received: number;
      pending: number;
      vendor_count: number;
    }>;
    // Enrich with planning_fee + target_income per project (project-level values).
    const ids = list.map((r) => r.project_id);
    let feeMap = new Map<string, { planning_fee: number; target_income: number }>();
    if (ids.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: projRows, error: pe } = await supabaseAdmin
        .from("projects")
        .select("id, planning_fee, target_income")
        .in("id", ids);
      if (pe) throw new Error(pe.message);
      feeMap = new Map(
        (projRows ?? []).map((p: any) => [
          p.id as string,
          {
            planning_fee: Number(p.planning_fee ?? 0),
            target_income: Number(p.target_income ?? 0),
          },
        ]),
      );
    }
    return list.map((r) => ({
      ...r,
      planning_fee: feeMap.get(r.project_id)?.planning_fee ?? 0,
      target_income: feeMap.get(r.project_id)?.target_income ?? 0,
    }));
  });


export const analyticsVendors = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().nullable().optional(), to: z.string().nullable().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: roleRow, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) throw new Error("Forbidden: admin only");
    const { data: rows, error } = await context.supabase.rpc("admin_analytics_vendors", {
      _from: (data.from ?? null) as unknown as string,
      _to: (data.to ?? null) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      vendor_id: string;
      vendor_name: string;
      category: string | null;
      bookings: number;
      client_billing: number;
      commission: number;
    }>;
  });

export const analyticsCategories = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().nullable().optional(), to: z.string().nullable().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: roleRow, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) throw new Error("Forbidden: admin only");
    const { data: rows, error } = await context.supabase.rpc("admin_analytics_categories", {
      _from: (data.from ?? null) as unknown as string,
      _to: (data.to ?? null) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      category: string;
      bookings: number;
      client_billing: number;
      commission: number;
    }>;
  });

// -------------------- Upcoming receivables (client → Saffron) --------------------

export interface UpcomingReceivable {
  project_id: string;
  bride_name: string | null;
  groom_name: string | null;
  installment_no: number | null;
  expected_amount: number;
  received_amount: number;
  due_date: string | null;
  status: "pending" | "partial" | "overdue";
}

export const analyticsUpcomingReceivables = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRow, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) throw new Error("Forbidden: admin only");
    const { data: rows, error } = await context.supabase.rpc("admin_upcoming_receivables");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): UpcomingReceivable => ({
      project_id: r.project_id,
      bride_name: r.bride_name ?? null,
      groom_name: r.groom_name ?? null,
      installment_no: r.installment_no ?? null,
      expected_amount: Number(r.expected_amount ?? 0),
      received_amount: Number(r.received_amount ?? 0),
      due_date: r.due_date ?? null,
      status: r.status as UpcomingReceivable["status"],
    }));
  });

// -------------------- Upcoming payments (Saffron → vendors) --------------------

export interface UpcomingPayment {
  project_id: string;
  bride_name: string | null;
  groom_name: string | null;
  vendor_id: string;
  vendor_name: string;
  installment_no: number;
  expected_amount: number;
  paid_amount: number;
  due_date: string | null;
  paid_by: "planner" | "client";
  status: "pending" | "partial" | "overdue";
}

export const analyticsUpcomingPayments = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRow, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) throw new Error("Forbidden: admin only");
    const { data: rows, error } = await context.supabase.rpc("admin_upcoming_payments");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): UpcomingPayment => ({
      project_id: r.project_id,
      bride_name: r.bride_name ?? null,
      groom_name: r.groom_name ?? null,
      vendor_id: r.vendor_id,
      vendor_name: r.vendor_name,
      installment_no: Number(r.installment_no),
      expected_amount: Number(r.expected_amount ?? 0),
      paid_amount: Number(r.paid_amount ?? 0),
      due_date: r.due_date ?? null,
      paid_by: r.paid_by as UpcomingPayment["paid_by"],
      status: r.status as UpcomingPayment["status"],
    }));
  });
