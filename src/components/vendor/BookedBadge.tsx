import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { getVendorBookedSummary } from "@/lib/quote-api";
import type { VendorBookedSummary } from "@/lib/quote-types";

/**
 * If `summary` is provided (including `null`), this component skips its own
 * query — the parent has already loaded a bulk summary for many vendors and
 * we use that. This prevents one HTTP request per card on the dashboard.
 */
export function BookedBadge({
  vendorId,
  compact = false,
  summary,
}: {
  vendorId: string;
  compact?: boolean;
  summary?: VendorBookedSummary | null;
}) {
  const provided = summary !== undefined;
  const { data } = useQuery({
    queryKey: ["vendor-booked-summary", vendorId],
    queryFn: () => getVendorBookedSummary([vendorId]),
    staleTime: 60_000,
    enabled: !provided,
  });
  const resolved = provided ? summary : data?.[vendorId];
  if (!resolved || !resolved.times_booked) return null;

  const tooltip = resolved.last_booked_at
    ? `Last booked ${new Date(resolved.last_booked_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
    : undefined;

  if (compact) {
    return (
      <span
        title={tooltip}
        className="inline-flex items-center gap-0.5 rounded-full border border-[var(--champagne)] bg-[var(--champagne)]/30 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--charcoal)]"
      >
        <Award className="h-2.5 w-2.5" /> Booked ×{resolved.times_booked}
      </span>
    );
  }

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--champagne)] bg-[var(--champagne)]/30 px-2 py-0.5 text-[11px] font-semibold text-[var(--charcoal)]"
    >
      <Award className="h-3 w-3" /> Previously booked ×{resolved.times_booked}
    </span>
  );
}
