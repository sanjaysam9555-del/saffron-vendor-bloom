import type { CategoryDeadline } from "@/server/project-deadlines.functions";
import type { TimelineItem } from "@/lib/urgency";

interface VendorLike {
  id: string;
  vendor_name?: string | null;
  category: string | null;
  client_status?: string | null;
  quote_summary?: { has_closed?: boolean } | null;
}

/**
 * Builds the per-category timeline items for both admin and client views.
 * The list of categories comes from vendors currently assigned to the project.
 * A category is "booked" if any assigned vendor in that category has a closed
 * quote OR a finalised client status. Deadline + criticality come from the
 * project_category_deadlines table (defaults to medium / null if not set).
 */
export function buildTimelineItems(
  vendors: VendorLike[],
  deadlines: CategoryDeadline[],
): TimelineItem[] {
  const byCat = new Map<
    string,
    { count: number; bookedVendorName: string | null; booked: boolean }
  >();
  for (const v of vendors) {
    const cat = (v.category ?? "").trim();
    if (!cat) continue;
    const entry = byCat.get(cat) ?? { count: 0, bookedVendorName: null, booked: false };
    entry.count += 1;
    const isBooked =
      !!v.quote_summary?.has_closed || v.client_status === "finalised";
    if (isBooked && !entry.booked) {
      entry.booked = true;
      entry.bookedVendorName = v.vendor_name ?? null;
    }
    byCat.set(cat, entry);
  }
  const dlMap = new Map(deadlines.map((d) => [d.category, d]));
  const out: TimelineItem[] = [];
  for (const [category, info] of byCat) {
    const dl = dlMap.get(category);
    out.push({
      category,
      vendor_count: info.count,
      due_date: dl?.due_date ?? null,
      criticality: (dl?.criticality ?? "medium"),
      notes: dl?.notes ?? null,
      booked: info.booked,
      booked_vendor_name: info.bookedVendorName,
    });
  }
  return out;
}
