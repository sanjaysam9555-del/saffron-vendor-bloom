import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
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
  maxChips?: number;
}

export function UrgencyStrip({ items, onChipClick, maxChips = 4 }: Props) {
  const now = useNow();
  const attention = useMemo(() => {
    const list = items
      .map((it) => ({ it, c: classifyUrgency(it, now) }))
      .filter((x) => ATTENTION.includes(x.c.bucket))
      .sort((a, b) => {
        // Most urgent first
        const order: UrgencyBucket[] = ["overdue", "urgent", "soon"];
        const d = order.indexOf(a.c.bucket) - order.indexOf(b.c.bucket);
        if (d !== 0) return d;
        return (a.it.due_date ?? "").localeCompare(b.it.due_date ?? "");
      });
    return list;
  }, [items, now]);

  if (attention.length === 0) return null;

  const shown = attention.slice(0, maxChips);
  const overflow = attention.length - shown.length;

  return (
    <div className="border-b border-amber-200/70 bg-amber-50/70">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 overflow-x-auto px-3 py-1.5 sm:px-6">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
        <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-amber-800">
          Needs attention
        </span>
        <div className="flex items-center gap-1.5">
          {shown.map(({ it, c }) => {
            const color = BUCKET_TOKEN[c.bucket];
            return (
              <button
                key={it.category}
                type="button"
                onClick={() => onChipClick?.(it.category)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-white px-2.5 py-1 text-xs shadow-sm transition-shadow hover:shadow"
                style={{ borderColor: color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                <span className="font-medium text-[var(--charcoal)]">{it.category}</span>
                <span className="text-[var(--charcoal)]/65">
                  · {BUCKET_LABEL[c.bucket]} · {daysLeftLabel(c.daysLeft)}
                </span>
              </button>
            );
          })}
          {overflow > 0 && (
            <span className="text-[11px] text-amber-800">+{overflow} more</span>
          )}
        </div>
      </div>
    </div>
  );
}
