import { useMemo } from "react";
import { AlarmClock } from "lucide-react";
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
const ROW_HEIGHT = 44; // px per attention row
const VISIBLE_ROWS = 3; // rows visible before auto-scroll kicks in

interface Props {
  items: TimelineItem[];
  onChipClick?: (category: string) => void;
  onViewAll?: () => void;
  maxChips?: number;
}

export function UrgencyStrip({ items, onChipClick }: Props) {
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

  const hasOverdue = attention.some((x) => x.c.bucket === "overdue");
  const pulseColor = hasOverdue ? "var(--urgency-overdue)" : "var(--urgency-urgent)";

  const shouldScroll = attention.length > VISIBLE_ROWS;
  // Duplicate the list for a seamless marquee loop when scrolling.
  const rendered = shouldScroll ? [...attention, ...attention] : attention;
  // ~2.6s per row keeps the rotation legible.
  const animationDuration = `${Math.max(8, attention.length * 2.6)}s`;
  const viewportHeight = Math.min(attention.length, VISIBLE_ROWS) * ROW_HEIGHT;

  return (
    <div
      className="relative border-b border-[var(--champagne)]"
      style={{
        background:
          "linear-gradient(180deg, var(--cream-deep, var(--cream)) 0%, var(--cream) 100%)",
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.02), 0 1px 0 rgba(0,0,0,0.02)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-3 py-2.5 sm:px-4">
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

        {/* Vertical notification list (auto-scrolls when overflowing) */}
        <div
          className="group relative overflow-hidden"
          style={{ height: viewportHeight }}
        >
          {shouldScroll && (
            <>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4"
                style={{
                  background:
                    "linear-gradient(180deg, var(--cream) 0%, transparent 100%)",
                }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4"
                style={{
                  background:
                    "linear-gradient(0deg, var(--cream) 0%, transparent 100%)",
                }}
              />
            </>
          )}
          <ul
            className={`flex flex-col ${shouldScroll ? "animate-marquee-y group-hover:[animation-play-state:paused]" : ""}`}
            style={
              shouldScroll
                ? {
                    animationDuration,
                    // Translate exactly the height of the first (non-duplicated) list.
                    ["--marquee-y" as string]: `-${attention.length * ROW_HEIGHT}px`,
                  }
                : undefined
            }
          >
            {rendered.map(({ it, c }, idx) => {
              const color = BUCKET_TOKEN[c.bucket];
              const isOverdue = c.bucket === "overdue";
              return (
                <li key={`${it.category}-${idx}`} style={{ height: ROW_HEIGHT }}>
                  <button
                    type="button"
                    onClick={() => onChipClick?.(it.category)}
                    className={`flex h-full w-full items-center gap-2.5 rounded-md bg-white/70 px-2.5 text-left text-xs shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:bg-white hover:shadow-[0_4px_10px_rgba(0,0,0,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terracotta)]/40 ${
                      isOverdue ? "animate-pulse-subtle" : ""
                    }`}
                    style={{
                      border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
                    }}
                    aria-label={`${it.category}: ${BUCKET_LABEL[c.bucket]}, ${daysLeftLabel(c.daysLeft)}`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--charcoal)]">
                      {it.category}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                      style={{
                        background: `color-mix(in oklab, ${color} 14%, white)`,
                        color: `color-mix(in oklab, ${color} 85%, var(--charcoal))`,
                      }}
                    >
                      {BUCKET_LABEL[c.bucket]}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--charcoal)]/60">
                      {daysLeftLabel(c.daysLeft)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
