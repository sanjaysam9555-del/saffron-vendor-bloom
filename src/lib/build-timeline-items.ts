import type { CategoryDeadline } from "@/lib/project-deadlines.functions";
import type { TimelineItem } from "@/lib/urgency";

interface VendorLike {
  id: string;
  vendor_name?: string | null;
  category: string | null;
  client_status?: string | null;
  quote_summary?: {
    has_closed?: boolean;
    closed_amount?: number | null;
  } | null;
}

interface CatInfo {
  count: number;
  bookedVendorName: string | null;
  booked: boolean;
  closedAmount: number | null;
}

function aggregateByCategory(vendors: VendorLike[]): Map<string, CatInfo> {
  const byCat = new Map<string, CatInfo>();
  for (const v of vendors) {
    const cat = (v.category ?? "").trim();
    if (!cat) continue;
    const entry =
      byCat.get(cat) ?? {
        count: 0,
        bookedVendorName: null,
        booked: false,
        closedAmount: null,
      };
    entry.count += 1;
    const isBooked =
      !!v.quote_summary?.has_closed || v.client_status === "finalised";
    if (isBooked && !entry.booked) {
      entry.booked = true;
      entry.bookedVendorName = v.vendor_name ?? null;
      entry.closedAmount = v.quote_summary?.closed_amount ?? null;
    }
    byCat.set(cat, entry);
  }
  return byCat;
}

const EMPTY_INFO: CatInfo = {
  count: 0,
  bookedVendorName: null,
  booked: false,
  closedAmount: null,
};

/**
 * Builds the per-category timeline items for the timeline + table views.
 *
 * - `admin` mode: iterates every category that has at least one assigned
 *   vendor (existing behaviour) so planners can see what's still missing a
 *   deadline row.
 * - `client` mode: iterates only categories the admin has explicitly added a
 *   deadline/priority row for. Categories with assigned vendors but no
 *   deadline row stay hidden from the client.
 */
export function buildTimelineItems(
  vendors: VendorLike[],
  deadlines: CategoryDeadline[],
  mode: "admin" | "client" = "admin",
): TimelineItem[] {
  const byCat = aggregateByCategory(vendors);
  const dlMap = new Map(deadlines.map((d) => [d.category, d]));
  const out: TimelineItem[] = [];

  if (mode === "client") {
    for (const dl of deadlines) {
      const info = byCat.get(dl.category) ?? EMPTY_INFO;
      const manualClosed = dl.actual_amount_override != null;
      out.push({
        category: dl.category,
        vendor_count: info.count,
        due_date: dl.due_date ?? null,
        criticality: dl.criticality ?? "medium",
        notes: dl.notes ?? null,
        booked: info.booked || manualClosed,
        booked_vendor_name: info.bookedVendorName,
        planned_amount: dl.planned_amount ?? null,
        closed_amount_auto: info.closedAmount,
        actual_amount_override: dl.actual_amount_override ?? null,
      });
    }
    return out;
  }

  for (const [category, info] of byCat) {
    const dl = dlMap.get(category);
    const manualClosed = dl?.actual_amount_override != null;
    out.push({
      category,
      vendor_count: info.count,
      due_date: dl?.due_date ?? null,
      criticality: dl?.criticality ?? "medium",
      notes: dl?.notes ?? null,
      booked: info.booked || manualClosed,
      booked_vendor_name: info.bookedVendorName,
      planned_amount: dl?.planned_amount ?? null,
      closed_amount_auto: info.closedAmount,
      actual_amount_override: dl?.actual_amount_override ?? null,
    });
  }
  // Include planner-added categories that don't yet have any vendor assigned.
  for (const dl of deadlines) {
    if (byCat.has(dl.category)) continue;
    const manualClosed = dl.actual_amount_override != null;
    out.push({
      category: dl.category,
      vendor_count: 0,
      due_date: dl.due_date ?? null,
      criticality: dl.criticality ?? "medium",
      notes: dl.notes ?? null,
      booked: manualClosed,
      booked_vendor_name: null,
      planned_amount: dl.planned_amount ?? null,
      closed_amount_auto: null,
      actual_amount_override: dl.actual_amount_override ?? null,
    });
  }
  return out;
}

