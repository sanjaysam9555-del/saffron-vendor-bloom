import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export type CalendarEventKind =
  | "wedding"
  | "deadline"
  /** Client → studio: planning-fee instalments still owed. */
  | "client_payment"
  /** Vendor → studio: commission still owed to us. */
  | "vendor_commission"
  /** Studio (or client) → vendor: instalments still to be paid out. */
  | "vendor_payment";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  /** ISO date (YYYY-MM-DD) the event falls on. */
  date: string;
  title: string;
  subtitle: string | null;
  project_id: string | null;
  /** Only set for deadlines. */
  criticality: string | null;
  /** Outstanding amount, for the three payment kinds. */
  amount: number | null;
  /**
   * `vendor_payment` only — who settles it. "client" means the couple pays the
   * vendor directly and the studio is only tracking it.
   */
  paid_by: string | null;
  /**
   * True when the date is inferred rather than scheduled. Commission rows have
   * no due-date column, so they are anchored to the wedding date.
   */
  date_is_estimated: boolean;
}

/**
 * Every dated item across the studio, in one payload.
 *
 * The dataset is small (active projects only), so we return the full set and
 * let the calendar page paginate months client-side — month navigation stays
 * instant with no refetch.
 */
export const getCalendarEvents = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .handler(async (): Promise<CalendarEvent[]> => {
    await requireStaff();

    const [projectsRes, deadlinesRes, clientPayRes, vendorPayRes, commissionRes] =
      await Promise.all([
        supabaseAdmin
          .from("projects")
          .select("id, bride_name, groom_name, wedding_date")
          .is("archived_at", null)
          .not("wedding_date", "is", null),
        supabaseAdmin
          .from("project_category_deadlines")
          .select("id, project_id, category, due_date, criticality")
          .not("due_date", "is", null),
        // No status filters on the three payment tables: `status` and the
        // actual balance disagree in the data (rows marked received that still
        // have money outstanding), so the remaining balance is the only
        // reliable signal. Each loop below drops anything fully settled.
        supabaseAdmin
          .from("project_payments")
          .select("id, project_id, label, installment_no, due_date, expected_amount, received_amount")
          .not("due_date", "is", null),
        supabaseAdmin
          .from("vendor_payment_installments")
          .select("id, project_id, vendor_id, installment_no, due_date, expected_amount, paid_amount, paid_by")
          .not("due_date", "is", null),
        supabaseAdmin
          .from("vendor_commission_payments")
          .select("id, project_id, vendor_id, installment_no, expected_amount, received_amount"),
      ]);

    const projects = projectsRes.data ?? [];
    const nameOf = new Map(
      projects.map((p) => [p.id, `${p.bride_name ?? "?"} & ${p.groom_name ?? "?"}`]),
    );
    const weddingDateOf = new Map(
      projects.map((p) => [p.id, p.wedding_date as string]),
    );

    // Vendor names for the payable/commission rows — one extra lookup keyed to
    // just the vendors actually referenced.
    const vendorIds = [
      ...new Set(
        [
          ...(vendorPayRes.data ?? []).map((r: any) => r.vendor_id),
          ...(commissionRes.data ?? []).map((r: any) => r.vendor_id),
        ].filter(Boolean),
      ),
    ];
    let vendorNameOf = new Map<string, string>();
    if (vendorIds.length > 0) {
      const { data: vendorRows } = await supabaseAdmin
        .from("vendors")
        .select("id, vendor_name")
        .in("id", vendorIds as string[]);
      vendorNameOf = new Map((vendorRows ?? []).map((v: any) => [v.id, v.vendor_name]));
    }

    const events: CalendarEvent[] = [];
    const base = { criticality: null, amount: null, paid_by: null, date_is_estimated: false };

    for (const p of projects) {
      events.push({
        ...base,
        id: `wedding-${p.id}`,
        kind: "wedding",
        date: p.wedding_date as string,
        title: `${p.bride_name ?? "?"} & ${p.groom_name ?? "?"}`,
        subtitle: "Wedding day",
        project_id: p.id,
      });
    }

    for (const d of deadlinesRes.data ?? []) {
      events.push({
        ...base,
        id: `deadline-${d.id}`,
        kind: "deadline",
        date: d.due_date as string,
        title: d.category,
        subtitle: nameOf.get(d.project_id) ?? null,
        project_id: d.project_id,
        criticality: d.criticality ?? null,
      });
    }

    // Client → studio
    for (const pay of clientPayRes.data ?? []) {
      const pending = Number(pay.expected_amount ?? 0) - Number(pay.received_amount ?? 0);
      if (pending <= 0) continue;
      events.push({
        ...base,
        id: `client-payment-${pay.id}`,
        kind: "client_payment",
        date: pay.due_date as string,
        title: pay.label || `Instalment ${pay.installment_no ?? ""}`.trim(),
        subtitle: nameOf.get(pay.project_id) ?? null,
        project_id: pay.project_id,
        amount: pending,
      });
    }

    // Studio (or client) → vendor
    for (const pay of vendorPayRes.data ?? []) {
      const pending = Number(pay.expected_amount ?? 0) - Number(pay.paid_amount ?? 0);
      if (pending <= 0) continue;
      const vendor = vendorNameOf.get(pay.vendor_id) ?? "Vendor";
      const project = nameOf.get(pay.project_id);
      events.push({
        ...base,
        id: `vendor-payment-${pay.id}`,
        kind: "vendor_payment",
        date: pay.due_date as string,
        title: `${vendor} · Instalment ${pay.installment_no}`,
        subtitle: project ?? null,
        project_id: pay.project_id,
        amount: pending,
        paid_by: pay.paid_by ?? null,
      });
    }

    // Vendor → studio (commission). No due-date column exists on this table,
    // so anchor to the wedding date and flag the date as inferred.
    for (const c of commissionRes.data ?? []) {
      const pending = Number(c.expected_amount ?? 0) - Number(c.received_amount ?? 0);
      if (pending <= 0) continue;
      const anchor = weddingDateOf.get(c.project_id);
      if (!anchor) continue; // nothing to date it against
      const vendor = vendorNameOf.get(c.vendor_id) ?? "Vendor";
      events.push({
        ...base,
        id: `vendor-commission-${c.id}`,
        kind: "vendor_commission",
        date: anchor,
        title: `${vendor} commission`,
        subtitle: nameOf.get(c.project_id) ?? null,
        project_id: c.project_id,
        amount: pending,
        date_is_estimated: true,
      });
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
  });
