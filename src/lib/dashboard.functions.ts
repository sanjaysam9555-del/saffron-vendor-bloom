import { createServerFn } from "@tanstack/react-start";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";

async function requireStaff(): Promise<{ userId: string }> {
  const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) throw new Error("Authentication is still loading.");
  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData.user) throw new Error("Authentication is still loading.");
  const userId = userData.user.id;
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  if (!roles || roles.length === 0) throw new Error("Forbidden: staff only");
  return { userId };
}

export interface DashboardData {
  stats: {
    active_projects: number;
    total_vendors: number;
    pending_quotes: number;
    pending_payments: number;
    unread_notifications: number;
  };
  upcoming_weddings: {
    id: string;
    bride_name: string;
    groom_name: string;
    wedding_date: string;
    days_to_go: number;
    vendor_count: number;
  }[];
  upcoming_deadlines: {
    id: string;
    project_id: string;
    bride_name: string;
    groom_name: string;
    category: string;
    due_date: string;
    criticality: string;
    days_to_go: number;
  }[];
  recent_activity: {
    id: string;
    kind: string;
    title: string;
    body: string | null;
    created_at: string;
    project_id: string | null;
    vendor_id: string | null;
  }[];
  budget_health: {
    project_id: string;
    bride_name: string;
    groom_name: string;
    wedding_date: string;
    planning_fee: number;
    total_received: number;
    vendor_closed_cost: number;
  }[];
  vendor_pipeline: {
    label: string;
    count: number;
    color: string;
  }[];
}

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .handler(async (): Promise<DashboardData> => {
    const { userId } = await requireStaff();

    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

    const [
      projectsRes,
      vendorCountRes,
      pendingQuotesRes,
      pendingPaymentsRes,
      deadlinesRes,
      notificationsRes,
      paymentsRes,
      vendorQuotesRes,
      projectVendorsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id, bride_name, groom_name, wedding_date, planning_fee, archived_at")
        .is("archived_at", null)
        .order("wedding_date", { ascending: true }),
      supabaseAdmin.from("vendors").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("project_vendor_quotes")
        .select("id", { count: "exact", head: true })
        .eq("is_final", false)
        .neq("status", "closed"),
      supabaseAdmin
        .from("project_payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("project_category_deadlines")
        .select("id, project_id, category, due_date, criticality")
        .gte("due_date", today)
        .lte("due_date", in30)
        .order("due_date", { ascending: true })
        .limit(20),
      supabaseAdmin
        .from("staff_notifications")
        .select("id, kind, title, body, created_at, project_id, vendor_id, read_by")
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("project_payments")
        .select("project_id, received_amount"),
      supabaseAdmin
        .from("project_vendor_quotes")
        .select("project_id, status, is_final, closed_amount, quote_amount"),
      supabaseAdmin
        .from("project_vendors")
        .select("project_id, vendor_id"),
    ]);

    const projects = projectsRes.data ?? [];
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // --- Stats ---
    const activeProjectCount = projects.length;
    const totalVendors = vendorCountRes.count ?? 0;
    const pendingQuoteCount = pendingQuotesRes.count ?? 0;
    const pendingPaymentCount = pendingPaymentsRes.count ?? 0;

    const unreadCount = (notificationsRes.data ?? []).filter(
      (n: any) => !n.read_by || !n.read_by[userId],
    ).length;

    // --- Upcoming weddings (next 4 from today) ---
    const todayMs = Date.now();
    const upcomingWeddings = projects
      .filter((p) => p.wedding_date >= today)
      .slice(0, 4)
      .map((p) => {
        const wdMs = new Date(p.wedding_date).getTime();
        const daysToGo = Math.ceil((wdMs - todayMs) / 86400_000);
        const pvForProject = (projectVendorsRes.data ?? []).filter(
          (pv: any) => pv.project_id === p.id,
        );
        return {
          id: p.id,
          bride_name: p.bride_name,
          groom_name: p.groom_name,
          wedding_date: p.wedding_date,
          days_to_go: daysToGo,
          vendor_count: pvForProject.length,
        };
      });

    // --- Upcoming deadlines with project names ---
    const deadlines = (deadlinesRes.data ?? []).map((d: any) => {
      const proj = projectMap.get(d.project_id);
      const wdMs = new Date(d.due_date).getTime();
      const daysToGo = Math.ceil((wdMs - todayMs) / 86400_000);
      return {
        id: d.id,
        project_id: d.project_id,
        bride_name: proj?.bride_name ?? "—",
        groom_name: proj?.groom_name ?? "—",
        category: d.category,
        due_date: d.due_date,
        criticality: d.criticality,
        days_to_go: daysToGo,
      };
    });

    // --- Recent activity ---
    const recentActivity = (notificationsRes.data ?? []).map((n: any) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      created_at: n.created_at,
      project_id: n.project_id ?? null,
      vendor_id: n.vendor_id ?? null,
    }));

    // --- Budget health per project ---
    const receivedByProject = new Map<string, number>();
    for (const p of paymentsRes.data ?? []) {
      const cur = receivedByProject.get(p.project_id) ?? 0;
      receivedByProject.set(p.project_id, cur + Number(p.received_amount ?? 0));
    }

    const vendorCostByProject = new Map<string, number>();
    for (const q of vendorQuotesRes.data ?? []) {
      if (q.is_final || q.status === "closed") {
        const amt = Number(q.closed_amount ?? q.quote_amount ?? 0);
        const cur = vendorCostByProject.get(q.project_id) ?? 0;
        vendorCostByProject.set(q.project_id, cur + amt);
      }
    }

    const budgetHealth = projects.map((p) => ({
      project_id: p.id,
      bride_name: p.bride_name,
      groom_name: p.groom_name,
      wedding_date: p.wedding_date,
      planning_fee: Number(p.planning_fee ?? 0),
      total_received: receivedByProject.get(p.id) ?? 0,
      vendor_closed_cost: vendorCostByProject.get(p.id) ?? 0,
    }));

    // --- Vendor pipeline (quote status buckets) ---
    const quotes = vendorQuotesRes.data ?? [];
    const received = quotes.filter((q: any) => q.status === "received" && !q.is_final).length;
    const revised = quotes.filter((q: any) => q.status === "revised").length;
    const closed = quotes.filter((q: any) => q.is_final || q.status === "closed").length;
    const noQuote =
      (projectVendorsRes.data ?? []).length -
      new Set(quotes.map((q: any) => `${q.project_id}::${(q as any).vendor_id}`)).size;

    const vendorPipeline = [
      { label: "No quote yet", count: Math.max(noQuote, 0), color: "bg-[var(--charcoal)]/10" },
      { label: "Quote received", count: received, color: "bg-blue-100" },
      { label: "Revised", count: revised, color: "bg-amber-100" },
      { label: "Finalised", count: closed, color: "bg-emerald-100" },
    ];

    return {
      stats: {
        active_projects: activeProjectCount,
        total_vendors: totalVendors,
        pending_quotes: pendingQuoteCount,
        pending_payments: pendingPaymentCount,
        unread_notifications: unreadCount,
      },
      upcoming_weddings: upcomingWeddings,
      upcoming_deadlines: deadlines,
      recent_activity: recentActivity,
      budget_health: budgetHealth,
      vendor_pipeline: vendorPipeline,
    };
  });
