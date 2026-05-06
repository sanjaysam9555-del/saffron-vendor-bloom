import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { getVendorBookedSummary } from "@/lib/quote-api";

export function BookedBadge({ vendorId, compact = false }: { vendorId: string; compact?: boolean }) {
  const { data } = useQuery({
    queryKey: ["vendor-booked-summary", vendorId],
    queryFn: () => getVendorBookedSummary([vendorId]),
    staleTime: 60_000,
  });
  const summary = data?.[vendorId];
  if (!summary || !summary.times_booked) return null;

  const tooltip = summary.last_booked_at
    ? `Last booked ${new Date(summary.last_booked_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
    : undefined;

  if (compact) {
    return (
      <span
        title={tooltip}
        className="inline-flex items-center gap-0.5 rounded-full border border-[var(--champagne)] bg-[var(--champagne)]/30 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--charcoal)]"
      >
        <Award className="h-2.5 w-2.5" /> Booked ×{summary.times_booked}
      </span>
    );
  }

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--champagne)] bg-[var(--champagne)]/30 px-2 py-0.5 text-[11px] font-semibold text-[var(--charcoal)]"
    >
      <Award className="h-3 w-3" /> Previously booked ×{summary.times_booked}
    </span>
  );
}
