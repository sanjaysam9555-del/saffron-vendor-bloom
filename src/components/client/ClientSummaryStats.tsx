import { Users, Heart, CheckCircle2, IndianRupee } from "lucide-react";
import type { ClientVendor } from "@/lib/project-types";
import type { TimelineItem } from "@/lib/urgency";
import { formatINR } from "@/lib/quote-types";

interface Props {
  vendors: ClientVendor[];
  items: TimelineItem[];
  onJump: (view: "grid" | "board" | "table" | "timeline") => void;
}

export function ClientSummaryStats({ vendors, items, onJump }: Props) {
  const total = vendors.length;
  const shortlisted = vendors.filter(
    (v) => v.client_status === "shortlisted" || v.client_status === "finalised" || v.client_status === "like",
  ).length;
  const totalCats = items.length;
  const bookedCats = items.filter((i) => i.booked).length;
  const actuals = items.reduce(
    (s, i) => s + ((i.actual_amount_override ?? i.closed_amount_auto) ?? 0),
    0,
  );
  const showBudget = actuals > 0;

  const tile = (opts: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    sub?: string;
    onClick: () => void;
  }) => (
    <button
      onClick={opts.onClick}
      className="group flex min-w-0 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--terracotta)] hover:shadow-sm sm:gap-3 sm:px-4 sm:py-3"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--terracotta-soft)] text-[var(--terracotta)] sm:h-9 sm:w-9">
        {opts.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--charcoal)]/55">
          {opts.label}
        </span>
        <span className="block truncate font-display text-base font-semibold text-[var(--charcoal)] sm:text-lg">
          {opts.value}
        </span>
        {opts.sub && (
          <span className="block truncate text-[10px] text-[var(--charcoal)]/55">{opts.sub}</span>
        )}
      </span>
    </button>
  );

  return (
    <div
      data-tour="summary-stats"
      className="mx-auto w-full max-w-[1600px] px-3 pt-3 sm:px-6 sm:pt-4"
    >
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {tile({
          icon: <Users className="h-4 w-4" />,
          label: "Vendors Shared",
          value: total,
          sub: total === 1 ? "1 vendor in your folio" : `${total} vendors in your folio`,
          onClick: () => onJump("grid"),
        })}
        {tile({
          icon: <Heart className="h-4 w-4" />,
          label: "Your Picks",
          value: shortlisted,
          sub: "Liked, shortlisted or finalised",
          onClick: () => onJump("board"),
        })}
        {tile({
          icon: <CheckCircle2 className="h-4 w-4" />,
          label: "Booked Categories",
          value: `${bookedCats}${totalCats ? ` / ${totalCats}` : ""}`,
          sub: totalCats ? `${Math.round((bookedCats / Math.max(totalCats, 1)) * 100)}% complete` : "No categories yet",
          onClick: () => onJump("timeline"),
        })}
        {showBudget
          ? tile({
              icon: <IndianRupee className="h-4 w-4" />,
              label: "Spend So Far",
              value: formatINR(actuals),
              sub: "Across booked vendors",
              onClick: () => onJump("timeline"),
            })
          : tile({
              icon: <IndianRupee className="h-4 w-4" />,
              label: "Budget",
              value: "—",
              sub: "Tracked once vendors are booked",
              onClick: () => onJump("timeline"),
            })}
      </div>
    </div>
  );
}
