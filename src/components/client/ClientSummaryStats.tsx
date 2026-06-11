import { Users, Heart, CheckCircle2, IndianRupee, CalendarHeart, Sparkles } from "lucide-react";
import type { ClientVendor } from "@/lib/project-types";
import type { TimelineItem } from "@/lib/urgency";
import { formatINR } from "@/lib/quote-types";

interface Props {
  vendors: ClientVendor[];
  items: TimelineItem[];
  brideName: string;
  groomName: string;
  weddingDate: string;
  onJump: (view: "grid" | "board" | "table" | "timeline") => void;
}

function daysUntil(iso: string): number {
  const today = new Date();
  const due = new Date(iso);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b - a) / 86400000);
}

export function ClientSummaryStats({ vendors, items, brideName, groomName, weddingDate, onJump }: Props) {
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

  const dateFmt = new Date(weddingDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const days = daysUntil(weddingDate);
  const countdown =
    days > 0
      ? `${days} day${days === 1 ? "" : "s"} to go`
      : days === 0
        ? "Today!"
        : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;

  const baseTile = "group flex min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-left sm:gap-2.5 sm:px-3 sm:py-2.5";
  const clickableTile = `${baseTile} transition-all hover:-translate-y-0.5 hover:border-[var(--terracotta)] hover:shadow-sm`;
  const iconWrap = "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--terracotta-soft)] text-[var(--terracotta)] sm:h-8 sm:w-8";

  const clickTile = (opts: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    sub?: string;
    onClick: () => void;
  }) => (
    <button onClick={opts.onClick} className={clickableTile}>
      <span className={iconWrap}>{opts.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--charcoal)]/55">
          {opts.label}
        </span>
        <span className="block truncate font-display text-sm font-semibold text-[var(--charcoal)] sm:text-base">
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-6">
        {/* Couple + date */}
        <div className={`${baseTile} col-span-2 sm:col-span-2 lg:col-span-2`}>
          <span className={iconWrap}>
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--charcoal)]/55">
              The Couple
            </span>
            <span className="block truncate font-display text-sm font-semibold text-[var(--charcoal)] sm:text-base">
              {brideName} <span className="text-[var(--terracotta)]">&amp;</span> {groomName}
            </span>
            <span className="block truncate text-[10px] text-[var(--charcoal)]/55">{dateFmt}</span>
          </span>
        </div>

        {/* Countdown */}
        <div className={baseTile}>
          <span className={iconWrap}>
            <CalendarHeart className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--charcoal)]/55">
              Countdown
            </span>
            <span className="block truncate font-display text-sm font-semibold text-[var(--charcoal)] sm:text-base">
              {countdown}
            </span>
            <span className="block truncate text-[10px] text-[var(--charcoal)]/55">to the big day</span>
          </span>
        </div>

        {clickTile({
          icon: <Users className="h-4 w-4" />,
          label: "Vendors",
          value: total,
          sub: total === 1 ? "1 in your folio" : `${total} in your folio`,
          onClick: () => onJump("grid"),
        })}
        {clickTile({
          icon: <Heart className="h-4 w-4" />,
          label: "Your Picks",
          value: shortlisted,
          sub: "Liked / shortlisted",
          onClick: () => onJump("board"),
        })}
        {clickTile({
          icon: <CheckCircle2 className="h-4 w-4" />,
          label: "Booked",
          value: `${bookedCats}${totalCats ? ` / ${totalCats}` : ""}`,
          sub: totalCats ? `${Math.round((bookedCats / Math.max(totalCats, 1)) * 100)}% complete` : "No categories yet",
          onClick: () => onJump("timeline"),
        })}
        {showBudget
          ? clickTile({
              icon: <IndianRupee className="h-4 w-4" />,
              label: "Spend",
              value: formatINR(actuals),
              sub: "Booked vendors",
              onClick: () => onJump("timeline"),
            })
          : clickTile({
              icon: <IndianRupee className="h-4 w-4" />,
              label: "Budget",
              value: "—",
              sub: "Tracked once booked",
              onClick: () => onJump("timeline"),
            })}
      </div>
    </div>
  );
}
