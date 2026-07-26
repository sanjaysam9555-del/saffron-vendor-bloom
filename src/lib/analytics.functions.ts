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

const RangeInput = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
});

export const analyticsOverview = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => RangeInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
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
  .inputValidator((d) => RangeInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    let pp = context.supabase.from("project_payments").select("expected_amount, received_amount, received_on");
    if (data.from) pp = pp.gte("received_on", data.from);
    if (data.to) pp = pp.lte("received_on", data.to);
    const { data: ppRows, error: e1 } = await pp;
    if (e1) throw new Error(e1.message);
    let vc = context.supabase.from("vendor_commission_payments").select("expected_amount, received_amount, received_on");
    if (data.from) vc = vc.gte("received_on", data.from);
    if (data.to) vc = vc.lte("received_on", data.to);
    const { data: vcRows, error: e2 } = await vc;
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

export const analyticsProjects = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => RangeInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await context.supabase.rpc("admin_analytics_projects", {
      _from: (data.from ?? null) as unknown as string,
      _to: (data.to ?? null) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
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
  });

export const analyticsVendors = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => RangeInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
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
  .inputValidator((d) => RangeInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
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
