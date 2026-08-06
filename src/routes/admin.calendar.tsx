import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  CalendarDays,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { getCalendarEvents, type CalendarEvent, type CalendarEventKind } from "@/lib/calendar.functions";
import { formatINRShort } from "@/lib/quote-types";

export const Route = createFileRoute("/admin/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Saffron Planning Studio" },
      { name: "description", content: "Weddings, deadlines and payment dates across every project." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin={false}>
      <AdminCalendarPage />
    </AuthGate>
  ),
});

// ── Date helpers (local-safe: never construct Date from a bare ISO string) ────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
/** Monday-first so Sat + Sun sit together — wedding weekends read as one block. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function todayISO() {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
/** Monday-indexed weekday (0 = Mon … 6 = Sun) of the 1st of the month. */
function leadingBlanks(y: number, m: number) {
  return (new Date(y, m, 1).getDay() + 6) % 7;
}
function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// ── Event styling ────────────────────────────────────────────────────────────

const KIND_META: Record<
  CalendarEventKind,
  { label: string; dot: string; pill: string; icon: React.ReactNode }
> = {
  wedding: {
    label: "Weddings",
    dot: "bg-[var(--terracotta)]",
    pill: "bg-[var(--terracotta)] text-[var(--cream)]",
    icon: <Heart className="h-3.5 w-3.5" />,
  },
  deadline: {
    label: "Deadlines",
    dot: "bg-[var(--gold)]",
    pill: "bg-[var(--gold-soft)] text-[hsl(38_45%_28%)] border border-[var(--gold)]/40",
    icon: <CalendarDays className="h-3.5 w-3.5" />,
  },
  client_payment: {
    label: "From client",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-900 border border-emerald-200",
    icon: <ArrowDownLeft className="h-3.5 w-3.5" />,
  },
  vendor_commission: {
    label: "From vendor",
    dot: "bg-sky-500",
    pill: "bg-sky-50 text-sky-900 border border-sky-200",
    icon: <ArrowDownLeft className="h-3.5 w-3.5" />,
  },
  vendor_payment: {
    label: "To vendor",
    dot: "bg-[var(--terracotta)]/50",
    pill: "bg-[var(--terracotta-soft)] text-[var(--terracotta)] border border-[var(--terracotta)]/30",
    icon: <ArrowUpRight className="h-3.5 w-3.5" />,
  },
};

/** Legend order — weddings/deadlines first, then money in, then money out. */
const KIND_ORDER: CalendarEventKind[] = [
  "wedding",
  "deadline",
  "client_payment",
  "vendor_commission",
  "vendor_payment",
];

function AdminCalendarPage() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => getCalendarEvents(),
    staleTime: 60_000,
  });

  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selected, setSelected] = useState<string>(today);
  const [hidden, setHidden] = useState<Set<CalendarEventKind>>(new Set());

  const visible = useMemo(
    () => events.filter((e) => !hidden.has(e.kind)),
    [events, hidden],
  );

  /** ISO date → events on that day. */
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of visible) {
      const list = m.get(e.date);
      if (list) list.push(e);
      else m.set(e.date, [e]);
    }
    return m;
  }, [visible]);

  const upcoming = useMemo(
    () => visible.filter((e) => e.date >= today).slice(0, 12),
    [visible, today],
  );

  const selectedEvents = byDate.get(selected) ?? [];

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const next = new Date(c.y, c.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  };
  const goToday = () => {
    const n = new Date();
    setCursor({ y: n.getFullYear(), m: n.getMonth() });
    setSelected(today);
  };

  const toggleKind = (k: CalendarEventKind) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const blanks = leadingBlanks(cursor.y, cursor.m);
  const total = daysInMonth(cursor.y, cursor.m);
  const cells: (string | null)[] = [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: total }, (_, i) => toISO(cursor.y, cursor.m, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      {/* Secondary toolbar */}
      <div className="h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="hidden text-sm text-[var(--charcoal)]/55 sm:inline">
            Weddings, deadlines and payment dates across every project.
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={goToday}
              className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--charcoal)]/75 transition hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              Today
            </button>
            <div className="flex items-center overflow-hidden rounded-md border border-[var(--border)] bg-white">
              <button
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="px-2 py-1.5 text-[var(--charcoal)]/60 transition hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="border-l border-[var(--border)] px-2 py-1.5 text-[var(--charcoal)]/60 transition hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-2 sm:px-6 sm:py-5">
        <div className="mb-6 hidden sm:block">
          <h1 className="brand-line hidden font-display text-xl font-semibold text-[var(--charcoal)] sm:block sm:text-2xl">
            Calendar
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Month grid ── */}
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
            {/* Month heading + legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <h2 className="font-display text-2xl text-[var(--charcoal)]">
                {MONTHS[cursor.m]}{" "}
                <span className="text-[var(--charcoal)]/40">{cursor.y}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                {KIND_ORDER.map((k) => {
                  const off = hidden.has(k);
                  return (
                    <button
                      key={k}
                      onClick={() => toggleKind(k)}
                      title={off ? `Show ${KIND_META[k].label.toLowerCase()}` : `Hide ${KIND_META[k].label.toLowerCase()}`}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        off
                          ? "border-[var(--border)] bg-white text-[var(--charcoal)]/35"
                          : "border-[var(--border)] bg-[var(--cream)]/60 text-[var(--charcoal)]/70"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${off ? "bg-[var(--charcoal)]/20" : KIND_META[k].dot}`} />
                      {KIND_META[k].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--cream)]/40">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/45"
                >
                  <span className="hidden sm:inline">{w}</span>
                  <span className="sm:hidden">{w[0]}</span>
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {cells.map((iso, i) => {
                if (!iso) {
                  return <div key={`b${i}`} className="min-h-[92px] border-b border-r border-[var(--border)]/50 bg-[var(--cream)]/20 last:border-r-0" />;
                }
                const dayEvents = byDate.get(iso) ?? [];
                const isToday = iso === today;
                const isSelected = iso === selected;
                const dayNum = Number(iso.slice(8));
                const isWeekend = i % 7 >= 5;

                return (
                  <button
                    key={iso}
                    onClick={() => setSelected(iso)}
                    className={`group relative min-h-[92px] border-b border-r border-[var(--border)]/50 p-1.5 text-left transition [&:nth-child(7n)]:border-r-0 ${
                      isSelected
                        ? "bg-[var(--terracotta-soft)]/40"
                        : isWeekend
                        ? "bg-[var(--cream)]/30 hover:bg-[var(--cream-deep)]/50"
                        : "hover:bg-[var(--cream)]/50"
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition ${
                        isToday
                          ? "bg-[var(--terracotta)] font-semibold text-[var(--cream)]"
                          : isSelected
                          ? "text-[var(--terracotta)]"
                          : "text-[var(--charcoal)]/70"
                      }`}
                    >
                      {dayNum}
                    </span>

                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map((e) => (
                        <div
                          key={e.id}
                          title={`${KIND_META[e.kind].label} — ${e.title}${e.subtitle ? ` · ${e.subtitle}` : ""}`}
                          className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${KIND_META[e.kind].pill}`}
                        >
                          {e.title}
                        </div>
                      ))}
                      {/* Beyond two, collapse to coloured dots so a busy day
                          still shows which kinds land on it. */}
                      {dayEvents.length > 2 && (
                        <div className="flex items-center gap-1 px-1.5 pt-0.5">
                          {dayEvents.slice(2, 7).map((e) => (
                            <span
                              key={e.id}
                              title={`${KIND_META[e.kind].label} — ${e.title}`}
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_META[e.kind].dot}`}
                            />
                          ))}
                          <span className="text-[10px] font-medium text-[var(--charcoal)]/45">
                            +{dayEvents.length - 2}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Side panel ── */}
          <div className="space-y-6">
            {/* Selected day */}
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] bg-[var(--cream)]/40 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/45">
                  {selected === today ? "Today" : "Selected"}
                </div>
                <div className="font-display text-lg text-[var(--charcoal)]">{prettyDate(selected)}</div>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-3">
                {selectedEvents.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-[var(--charcoal)]/45">
                    Nothing scheduled.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedEvents.map((e) => (
                      <EventRow key={e.id} event={e} />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Upcoming */}
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] bg-[var(--cream)]/40 px-4 py-3">
                <div className="font-display text-lg text-[var(--charcoal)]">What's Next</div>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-3">
                {isLoading ? (
                  <p className="flex items-center justify-center gap-2 px-1 py-6 text-xs text-[var(--charcoal)]/45">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse text-[var(--terracotta)]" />
                    Loading…
                  </p>
                ) : upcoming.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-[var(--charcoal)]/45">
                    Nothing on the horizon.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {upcoming.map((e) => (
                      <EventRow key={e.id} event={e} showDate onJump={() => {
                        const [y, m] = e.date.split("-").map(Number);
                        setCursor({ y, m: m - 1 });
                        setSelected(e.date);
                      }} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  showDate,
  onJump,
}: {
  event: CalendarEvent;
  showDate?: boolean;
  onJump?: () => void;
}) {
  const meta = KIND_META[event.kind];

  const body = (
    <div className="flex items-start gap-2.5">
      <span className={`mt-0.5 shrink-0 rounded-md p-1.5 ${meta.pill}`}>{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--charcoal)]">{event.title}</div>
        {event.subtitle && (
          <div className="truncate text-[11px] text-[var(--charcoal)]/55">{event.subtitle}</div>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[var(--charcoal)]/45">
          {showDate && (
            <span>
              {prettyDate(event.date)}
              {event.date_is_estimated && " (est.)"}
            </span>
          )}
          {event.amount != null && (
            <span className="font-semibold text-[var(--terracotta)]">{formatINRShort(event.amount)}</span>
          )}
          {event.paid_by && (
            <span className="uppercase tracking-wider">paid by {event.paid_by}</span>
          )}
          {event.criticality && <span className="uppercase tracking-wider">{event.criticality}</span>}
          {event.date_is_estimated && !showDate && (
            <span className="uppercase tracking-wider">est. date</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <li>
      {event.project_id ? (
        <Link
          to="/admin/projects/$id"
          params={{ id: event.project_id }}
          onClick={onJump}
          className="block rounded-lg border border-transparent p-2 transition hover:border-[var(--border)] hover:bg-[var(--cream)]/50"
        >
          {body}
        </Link>
      ) : (
        <div className="p-2">{body}</div>
      )}
    </li>
  );
}
