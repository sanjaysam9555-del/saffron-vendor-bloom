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
}

function daysUntil(iso: string): number {
  const today = new Date();
  const due = new Date(iso);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b - a) / 86400000);
}

export function ClientSummaryView({ vendors, items, brideName, groomName, weddingDate }: Props) {
  const total = vendors.length;
  const shortlisted = vendors.filter(
    (v) => v.client_status === "shortlisted" || v.client_status === "finalised" || v.client_status === "like",
  ).length;
  const finalised = vendors.filter((v) => v.client_status === "finalised").length;
  const totalCats = items.length;
  const bookedCats = items.filter((i) => i.booked).length;
  const actuals = items.reduce(
    (s, i) => s + ((i.actual_amount_override ?? i.closed_amount_auto) ?? 0),
    0,
  );
  const bookedPct = totalCats ? Math.round((bookedCats / totalCats) * 100) : 0;

  const dateFmt = new Date(weddingDate).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const days = daysUntil(weddingDate);
  const countdownLabel =
    days > 0 ? "days to go" : days === 0 ? "the big day" : "days ago";
  const countdownValue = days > 0 ? days : days === 0 ? "Today" : Math.abs(days);

  const categoriesBooked = items.filter((i) => i.booked);
  const categoriesPending = items.filter((i) => !i.booked);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero band */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--cream-deep)] px-6 py-8 sm:px-10 sm:py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--terracotta) 10%, transparent) 0%, transparent 55%), radial-gradient(90% 70% at 100% 100%, color-mix(in oklab, var(--champagne) 35%, transparent) 0%, transparent 60%)",
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--terracotta)]/30 to-transparent" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--terracotta)]">
              <Sparkles className="h-3 w-3" /> The Wedding Of
            </span>
            <h2 className="mt-2 font-display text-3xl font-semibold text-[var(--charcoal)] sm:text-4xl">
              {brideName} <span className="text-[var(--terracotta)]">&amp;</span> {groomName}
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal)]/65">{dateFmt}</p>
          </div>
          <div className="shrink-0 rounded-xl border border-[var(--border)] bg-white/90 px-5 py-3 text-center shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur">
            <span className="block text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--charcoal)]/55">
              <CalendarHeart className="mr-1 inline h-3 w-3 text-[var(--terracotta)]" />
              Countdown
            </span>
            <span className="mt-1 block font-display text-3xl font-semibold text-[var(--charcoal)]">
              {countdownValue}
            </span>
            <span className="text-[11px] text-[var(--charcoal)]/60">{countdownLabel}</span>
          </div>
        </div>
      </section>

      {/* Stat rows */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatRow
          icon={<Users className="h-4 w-4" />}
          label="Vendors in your folio"
          value={total}
          hint={total === 1 ? "1 vendor curated for you" : `${total} vendors curated for you`}
        />
        <StatRow
          icon={<Heart className="h-4 w-4" />}
          label="Your picks"
          value={shortlisted}
          hint={`${finalised} finalised`}
        />
        <StatRow
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Categories booked"
          value={`${bookedCats}${totalCats ? ` / ${totalCats}` : ""}`}
          hint={totalCats ? `${bookedPct}% complete` : "No categories yet"}
          progress={totalCats ? bookedPct : undefined}
        />
        <StatRow
          icon={<IndianRupee className="h-4 w-4" />}
          label="Spend so far"
          value={actuals > 0 ? formatINR(actuals) : "—"}
          hint={actuals > 0 ? "Across booked vendors" : "Tracked once vendors are booked"}
        />
      </section>

      {/* Category breakdown */}
      {totalCats > 0 && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CategoryList
            title="Booked"
            tone="ok"
            items={categoriesBooked.map((i) => ({
              name: i.category,
              meta: (i.actual_amount_override ?? i.closed_amount_auto)
                ? formatINR((i.actual_amount_override ?? i.closed_amount_auto)!)
                : "Confirmed",
            }))}
            emptyText="Nothing booked yet — your planner will update this as vendors confirm."
          />
          <CategoryList
            title="Still to book"
            tone="pending"
            items={categoriesPending.map((i) => ({
              name: i.category,
              meta: i.due_date
                ? `Due ${new Date(i.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                : "No deadline set",
            }))}
            emptyText="Every category is booked. You're all set!"
          />
        </section>
      )}
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  hint,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  progress?: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-white px-4 py-3.5">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--terracotta-soft)] text-[var(--terracotta)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--charcoal)]/55">
          {label}
        </span>
        <span className="mt-0.5 block font-display text-xl font-semibold text-[var(--charcoal)]">
          {value}
        </span>
        {hint && <span className="block text-[11px] text-[var(--charcoal)]/60">{hint}</span>}
        {typeof progress === "number" && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--cream-deep)]">
            <div
              className="h-full rounded-full bg-[var(--terracotta)] transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryList({
  title,
  tone,
  items,
  emptyText,
}: {
  title: string;
  tone: "ok" | "pending";
  items: { name: string; meta: string }[];
  emptyText: string;
}) {
  const dot = tone === "ok" ? "bg-emerald-500" : "bg-[var(--terracotta)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-[var(--charcoal)]/70">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--charcoal)]/55">{emptyText}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {items.map((it) => (
            <li key={it.name} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                <span className="truncate text-[var(--charcoal)]">{it.name}</span>
              </span>
              <span className="shrink-0 text-xs text-[var(--charcoal)]/60">{it.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
