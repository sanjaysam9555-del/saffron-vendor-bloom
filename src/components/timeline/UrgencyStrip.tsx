import { useMemo } from "react";
import { AlarmClock, ArrowRight } from "lucide-react";
import {
  BUCKET_LABEL,
  BUCKET_TOKEN,
  classifyUrgency,
  daysLeftLabel,
  useNow,
  type TimelineItem,
  type UrgencyBucket,
} from "@/lib/urgency";

const ATTENTION: UrgencyBucket[] = ["overdue", "urgent", "soon"];

interface Props {
  items: TimelineItem[];
  onChipClick?: (category: string) => void;
  onViewAll?: () => void;
  maxChips?: number;
}

export function UrgencyStrip({ items, onChipClick, onViewAll, maxChips = 6 }: Props) {
  const now = useNow();
  const attention = useMemo(() => {
    const order: UrgencyBucket[] = ["overdue", "urgent", "soon"];
    return items
      .map((it) => ({ it, c: classifyUrgency(it, now) }))
      .filter((x) => ATTENTION.includes(x.c.bucket))
      .sort((a, b) => {
        const d = order.indexOf(a.c.bucket) - order.indexOf(b.c.bucket);
        if (d !== 0) return d;
        return (a.it.due_date ?? "").localeCompare(b.it.due_date ?? "");
      });
  }, [items, now]);

  if (attention.length === 0) return null;

  const shown = attention.slice(0, maxChips);
  const overflow = attention.length - shown.length;
  const hasOverdue = attention.some((x) => x.c.bucket === "overdue");
  const pulseColor = hasOverdue ? "var(--urgency-overdue)" : "var(--urgency-urgent)";

  return (
    <div
      className="relative border-b border-[var(--champagne)]"
      style={{
        background:
          "linear-gradient(180deg, var(--cream-deep, var(--cream)) 0%, var(--cream) 100%)",
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.02), 0 1px 0 rgba(0,0,0,0.02)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
        {/* Label */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="relative inline-flex h-5 w-5 items-center justify-center">
            <span
              className="absolute inline-flex h-3.5 w-3.5 animate-ping rounded-full opacity-40"
              style={{ background: pulseColor }}
            />
            <AlarmClock className="relative h-4 w-4 text-[var(--terracotta)] animate-buzz" />
          </span>
          <span className="font-display text-[13px] font-medium text-[var(--charcoal)]">
            Needs your attention
          </span>
          <span
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white"
            style={{ background: "var(--terracotta)" }}
          >
            {attention.length}
          </span>
        </div>

        {/* Chip rail with edge fades */}
        <div className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4"
            style={{
              background:
                "linear-gradient(90deg, var(--cream) 0%, transparent 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4"
            style={{
              background:
                "linear-gradient(270deg, var(--cream) 0%, transparent 100%)",
            }}
          />
          <div className="flex items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {shown.map(({ it, c }) => {
              const color = BUCKET_TOKEN[c.bucket];
              const isOverdue = c.bucket === "overdue";
              return (
                <button
                  key={it.category}
                  type="button"
                  onClick={() => onChipClick?.(it.category)}
                  className={`group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white py-1 pl-2 pr-2.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(0,0,0,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terracotta)]/40 ${
                    isOverdue ? "animate-pulse-subtle" : ""
                  }`}
                  style={{
                    border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`,
                  }}
                  aria-label={`${it.category}: ${BUCKET_LABEL[c.bucket]}, ${daysLeftLabel(c.daysLeft)}`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="font-medium text-[var(--charcoal)]">
                    {it.category}
                  </span>
                  <span className="text-[var(--charcoal)]/55">·</span>
                  <span
                    className="rounded-full px-1.5 py-px text-[10px] font-medium"
                    style={{
                      background: `color-mix(in oklab, ${color} 14%, white)`,
                      color: `color-mix(in oklab, ${color} 85%, var(--charcoal))`,
                    }}
                  >
                    {daysLeftLabel(c.daysLeft)}
                  </span>
                </button>
              );
            })}
            {overflow > 0 && (
              <span className="shrink-0 px-1 text-[11px] text-[var(--charcoal)]/60">
                +{overflow} more
              </span>
            )}
          </div>
        </div>

        {/* View all */}
        <button
          type="button"
          onClick={() => (onViewAll ? onViewAll() : onChipClick?.(attention[0].it.category))}
          className="hidden shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--terracotta)] hover:bg-white sm:inline-flex"
        >
          View all <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
