import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Heart,
  Users,
  FileText,
  Wallet,
  Bell,
  CalendarDays,
  CircleDot,
  Clock3,
  Sparkles,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { getDashboardData, type DashboardData } from "@/lib/dashboard.functions";
import { analyticsProjects } from "@/lib/analytics.functions";
import { formatINR, formatINRShort } from "@/lib/quote-types";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Saffron Planning Studio" },
      {
        name: "description",
        content:
          "Command centre: upcoming weddings, deadlines, budget health, and vendor pipeline.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin={false}>
      <AdminDashboardPage />
    </AuthGate>
  ),
});

function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardData(),
    staleTime: 60_000,
  });

  const { data: plData = [] } = useQuery({
    queryKey: ["analytics-projects-all"],
    queryFn: () => analyticsProjects({ data: { from: null, to: null } }),
    staleTime: 120_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)]">
        <span className="flex items-center gap-2 text-sm text-[var(--charcoal)]/50">
          <Sparkles className="h-4 w-4 animate-pulse text-[var(--terracotta)]" />
          Loading dashboard…
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      {/* Secondary toolbar — redundant with the heading's own subtitle on
          mobile, where every line of vertical space is precious. */}
      <div className="hidden h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70 sm:block">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="text-sm text-[var(--charcoal)]/55">All active weddings at a glance.</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        {/* Page heading — on mobile the title lives in the top bar next to the
            brand name, so it is hidden here to save vertical space. */}
        <div className="hidden sm:mb-8 sm:block">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Dashboard
          </h1>
        </div>


        {/* ── Stat cards ── */}
        <StatCards stats={data.stats} />

        {/* ── Upcoming weddings ── */}
        <Section title="Upcoming Weddings" icon={<Heart className="h-4 w-4" />}>
          <UpcomingWeddings weddings={data.upcoming_weddings} />
        </Section>

        {/* ── Two-column: deadlines + activity (equal height via overflow-y-auto) ── */}
        <div className="mt-6 grid gap-6 sm:mt-10 lg:grid-cols-2">
          <div>
            <SectionTitle icon={<CalendarDays className="h-4 w-4" />} title="Deadlines · Next 30 Days" />
            <UpcomingDeadlines deadlines={data.upcoming_deadlines} />
          </div>
          <div>
            <SectionTitle icon={<Clock3 className="h-4 w-4" />} title="Recent Activity" />
            <RecentActivity activity={data.recent_activity} />
          </div>
        </div>

        {/* ── Per-project P&L ── */}
        <Section title="Per-project P&L" icon={<Wallet className="h-4 w-4" />}>
          <PLTable rows={plData} />
        </Section>

        {/* ── Vendor pipeline ── */}
        <Section title="Vendor Pipeline" icon={<CircleDot className="h-4 w-4" />}>
          <VendorPipeline pipeline={data.vendor_pipeline} />
        </Section>

      </div>
    </div>
  );
}

// ── Section wrappers ───────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 sm:mt-10">
      <SectionTitle icon={icon} title={title} />
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 sm:mb-3">
      {icon && <span className="shrink-0 text-[var(--terracotta)]">{icon}</span>}
      <h2 className="min-w-0 truncate font-display text-lg text-[var(--charcoal)] sm:text-xl">{title}</h2>
    </div>
  );
}

/** Mobile lists show a short slice with a toggle so the page scrolls once. */
function MobileMore({ expanded, hidden, onToggle }: { expanded: boolean; hidden: number; onToggle: () => void }) {
  if (!expanded && hidden <= 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full border-t border-[var(--border)] px-4 py-2.5 text-center text-xs font-medium text-[var(--terracotta)] lg:hidden"
    >
      {expanded ? "Show less" : `Show all (${hidden} more)`}
    </button>
  );
}

// ── Stat cards ────────────────────────────────────────────────────────────────

function StatCards({ stats }: { stats: DashboardData["stats"] }) {
  const cards = [
    { label: "Active weddings",      value: stats.active_projects,      icon: <Heart className="h-4 w-4" />,    accent: true },
    { label: "Total vendors",        value: stats.total_vendors,         icon: <Users className="h-4 w-4" /> },
    { label: "Pending quotes",       value: stats.pending_quotes,        icon: <FileText className="h-4 w-4" /> },
    { label: "Pending payments",     value: stats.pending_payments,      icon: <Wallet className="h-4 w-4" /> },
    { label: "Unread notifications", value: stats.unread_notifications,  icon: <Bell className="h-4 w-4" /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-lg border p-3 sm:p-4 ${c.accent ? "col-span-2 lg:col-span-1" : ""} ${
            c.accent
              ? "border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)]"
              : "border-[var(--border)] bg-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={c.accent ? "text-[var(--terracotta)]" : "text-[var(--charcoal)]/50"}>
              {c.icon}
            </span>
            <span
              className={`font-display text-2xl font-semibold leading-none sm:text-3xl ${
                c.accent ? "text-[var(--terracotta)]" : "text-[var(--charcoal)]"
              }`}
            >
              {c.value}
            </span>
          </div>
          <div className="mt-1.5 text-[10px] font-medium uppercase tracking-widest text-[var(--charcoal)]/55">
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Upcoming weddings ─────────────────────────────────────────────────────────

function UpcomingWeddings({ weddings }: { weddings: DashboardData["upcoming_weddings"] }) {
  if (weddings.length === 0) return <EmptyCard message="No upcoming weddings." />;

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {weddings.map((w) => (
        <Link
          key={w.id}
          to="/admin/projects/$id"
          params={{ id: w.id }}
          className="group vendor-card flex flex-col rounded-lg bg-white p-2.5 text-[var(--charcoal)] sm:p-4"
        >
          <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold leading-tight sm:text-lg">
                {w.bride_name} &amp; {w.groom_name}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--charcoal)]/55 sm:text-xs">
                {fmtDateShort(w.wedding_date)}
              </p>
            </div>
            <span className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:text-[11px] ${daysClass(w.days_to_go)}`}>
              {w.days_to_go}d
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--charcoal)]/50 sm:mt-3 sm:gap-1.5 sm:text-[11px]">
            <Users className="h-3 w-3 shrink-0" />
            {w.vendor_count} vendor{w.vendor_count !== 1 ? "s" : ""}
          </div>
        </Link>
      ))}
    </div>
  );

}

function daysClass(d: number) {
  if (d <= 14) return "bg-[var(--terracotta-soft)] text-[var(--terracotta)] border border-[var(--terracotta)]/20";
  if (d <= 60) return "bg-[var(--gold-soft)] text-[var(--gold)] border border-[var(--gold)]/20";
  return "bg-[var(--cream-deep)] text-[var(--charcoal)]/60 border border-[var(--border)]";
}

// ── Upcoming deadlines ────────────────────────────────────────────────────────

const MOBILE_LIST_LIMIT = 6;

function UpcomingDeadlines({ deadlines }: { deadlines: DashboardData["upcoming_deadlines"] }) {
  const [expanded, setExpanded] = useState(false);
  if (deadlines.length === 0) return <EmptyCard message="No deadlines in the next 30 days." />;

  const hidden = Math.max(0, deadlines.length - MOBILE_LIST_LIMIT);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white">
      <ul className="no-scrollbar divide-y divide-[var(--border)] lg:max-h-[540px] lg:overflow-y-auto">
        {deadlines.map((d, i) => (
          <li
            key={d.id}
            className={`px-3 py-2.5 sm:px-4 ${!expanded && i >= MOBILE_LIST_LIMIT ? "hidden lg:block" : ""}`}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:items-center">
              {/* Fixed-width badge lines categories up on desktop; inline chip on mobile */}
              <span
                className={`hidden w-14 shrink-0 rounded-full py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide lg:inline-block ${criticalityClass(d.criticality)}`}
              >
                {d.criticality}
              </span>
              <div className="min-w-0 lg:flex-1">
                <p className="truncate text-sm font-medium text-[var(--charcoal)]">{d.category}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-[var(--charcoal)]/50">
                  <span
                    className={`inline-block rounded-full px-1.5 text-[9px] font-semibold uppercase tracking-wide lg:hidden ${criticalityClass(d.criticality)}`}
                  >
                    {d.criticality}
                  </span>
                  <span className="truncate">
                    {d.bride_name} &amp; {d.groom_name}
                  </span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-xs font-semibold ${d.days_to_go <= 7 ? "text-[var(--terracotta)]" : "text-[var(--charcoal)]/60"}`}>
                  {d.days_to_go}d
                </p>
                <p className="text-[10px] text-[var(--charcoal)]/40">{fmtDateShort(d.due_date)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <MobileMore expanded={expanded} hidden={hidden} onToggle={() => setExpanded((v) => !v)} />
    </div>
  );
}

function criticalityClass(c: string) {
  if (c === "high") return "bg-[var(--criticality-high-bg)] text-[var(--terracotta)]";
  if (c === "medium") return "bg-[var(--criticality-med-bg)] text-[hsl(30_50%_30%)]";
  return "bg-[var(--criticality-low-bg)] text-[var(--charcoal)]/60";
}

// ── Recent activity ───────────────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  quote_received: "Quote",
  quote_revised: "Revised",
  quote_finalised: "Final",
  payment_received: "Payment",
  vendor_added: "Vendor",
  project_created: "Project",
  deadline_set: "Deadline",
  status_change: "Update",
  comment: "Comment",
};

function RecentActivity({ activity }: { activity: DashboardData["recent_activity"] }) {
  const [expanded, setExpanded] = useState(false);
  if (activity.length === 0) return <EmptyCard message="No recent activity." />;

  const hidden = Math.max(0, activity.length - MOBILE_LIST_LIMIT);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white">
      <ul className="no-scrollbar divide-y divide-[var(--border)] lg:max-h-[540px] lg:overflow-y-auto">
        {activity.map((a, i) => (
          <li
            key={a.id}
            className={`px-3 py-2.5 sm:px-4 ${!expanded && i >= MOBILE_LIST_LIMIT ? "hidden lg:block" : ""}`}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 lg:flex lg:items-start">
              {/* Fixed-width chip lines titles up on desktop; inline chip on mobile */}
              <span className="mt-0.5 hidden w-14 shrink-0 rounded border border-[var(--border)] bg-[var(--cream-deep)] py-0.5 text-center text-[10px] font-medium text-[var(--charcoal)]/60 lg:inline-block">
                {KIND_LABEL[a.kind] ?? a.kind}
              </span>
              <div className="min-w-0 lg:flex-1">
                <p className="truncate text-sm font-medium text-[var(--charcoal)]">{a.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--charcoal)]/50">
                  <span className="inline-block rounded border border-[var(--border)] bg-[var(--cream-deep)] px-1.5 text-[9px] font-medium text-[var(--charcoal)]/60 lg:hidden">
                    {KIND_LABEL[a.kind] ?? a.kind}
                  </span>
                  {a.body && <span className="truncate">{a.body}</span>}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-[var(--charcoal)]/40">{timeAgo(a.created_at)}</span>
            </div>
          </li>
        ))}
      </ul>
      <MobileMore expanded={expanded} hidden={hidden} onToggle={() => setExpanded((v) => !v)} />
    </div>
  );
}

// ── Per-project P&L ───────────────────────────────────────────────────────────

type PLRow = Awaited<ReturnType<typeof analyticsProjects>>[number];

function PLTable({ rows }: { rows: PLRow[] }) {
  if (rows.length === 0) return <EmptyCard message="No project data yet." />;

  const derive = (p: PLRow) => {
    const planning = Number(p.planning_fee ?? 0);
    const commission = Number(p.commission ?? 0);
    const clientBilling = Number(p.client_billing ?? 0);
    const vendorCost = Number(p.vendor_cost ?? 0);
    return {
      planning,
      commission,
      clientBilling,
      vendorCost,
      margin: clientBilling > 0 ? (commission / clientBilling) * 100 : 0,
      totalIncome: planning + commission,
    };
  };

  return (
    <>
      {/* Mobile: stacked cards so no money column is hidden off-screen */}
      <div className="grid gap-2.5 lg:hidden">
        {rows.map((p) => {
          const d = derive(p);
          return (
            <div key={p.project_id} className="rounded-lg border border-[var(--border)] bg-white p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                <Link
                  to="/admin/projects/$id"
                  params={{ id: p.project_id }}
                  className="truncate font-medium text-[var(--terracotta)]"
                >
                  {(p.bride_name || "?") + " & " + (p.groom_name || "?")}
                </Link>
                <span className="shrink-0 text-[11px] text-[var(--charcoal)]/55">
                  {p.wedding_date ? fmtDateShort(p.wedding_date) : "—"}
                </span>
              </div>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <PLStat label="Planning fee" value={formatINR(d.planning)} />
                <PLStat label="Client billing" value={formatINR(d.clientBilling)} strong />
                <PLStat label="Vendor cost" value={formatINR(d.vendorCost)} />
                <PLStat label="Commission" value={formatINR(d.commission)} accent />
                <PLStat label="Margin" value={`${d.margin.toFixed(1)}%`} />
                <PLStat label="Total income" value={formatINRShort(d.totalIncome)} strong />
              </dl>
            </div>
          );
        })}
      </div>

      {/* Desktop: full table */}
      <div className="hidden overflow-hidden rounded-lg border border-[var(--border)] bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/75">
              <tr>
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5">Wedding</th>
                <th className="px-4 py-2.5 text-right">Planning fee</th>
                <th className="px-4 py-2.5 text-right">Client billing</th>
                <th className="px-4 py-2.5 text-right">Vendor cost</th>
                <th className="px-4 py-2.5 text-right">Commission</th>
                <th className="px-4 py-2.5 text-right">Margin</th>
                <th className="px-4 py-2.5 text-right">Total income</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const d = derive(p);
                return (
                  <tr key={p.project_id} className="border-t border-[var(--border)] hover:bg-[var(--cream)]/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/projects/$id"
                        params={{ id: p.project_id }}
                        className="font-medium text-[var(--terracotta)] hover:underline"
                      >
                        {(p.bride_name || "?") + " & " + (p.groom_name || "?")}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--charcoal)]/55">
                      {p.wedding_date ? fmtDate(p.wedding_date) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--charcoal)]/70">{formatINR(d.planning)}</td>
                    <td className="px-4 py-3 text-right font-medium text-[var(--charcoal)]">{formatINR(d.clientBilling)}</td>
                    <td className="px-4 py-3 text-right text-[var(--charcoal)]/60">{formatINR(d.vendorCost)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--terracotta)]">{formatINR(d.commission)}</td>
                    <td className="px-4 py-3 text-right text-[var(--charcoal)]/70">{d.margin.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--charcoal)]">{formatINRShort(d.totalIncome)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PLStat({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-widest text-[var(--charcoal)]/45">{label}</dt>
      <dd
        className={`truncate ${
          accent
            ? "font-semibold text-[var(--terracotta)]"
            : strong
              ? "font-semibold text-[var(--charcoal)]"
              : "text-[var(--charcoal)]/70"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

// ── Vendor pipeline ───────────────────────────────────────────────────────────

const PIPE_COLORS = [
  "bg-[var(--cream-deep)]",
  "bg-[var(--champagne)]/80",
  "bg-[var(--gold)]",
  "bg-[var(--terracotta)]",
] as const;

const PIPE_DOT_COLORS = [
  "bg-[var(--cream-deep)] border border-[var(--border)]",
  "bg-[var(--champagne)]",
  "bg-[var(--gold)]",
  "bg-[var(--terracotta)]",
] as const;

function VendorPipeline({ pipeline }: { pipeline: DashboardData["vendor_pipeline"] }) {
  const total = pipeline.reduce((s, p) => s + p.count, 0);
  if (total === 0) return <EmptyCard message="No vendor quotes yet." />;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 sm:p-5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--cream-deep)]">
        {pipeline
          .filter((p) => p.count > 0)
          .map((p, i) => (
            <div
              key={p.label}
              title={`${p.label}: ${p.count}`}
              className={`h-full transition-all ${PIPE_COLORS[i] ?? "bg-[var(--charcoal)]/20"}`}
              style={{ width: `${(p.count / total) * 100}%` }}
            />
          ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:mt-4 sm:flex sm:flex-wrap sm:gap-6">
        {pipeline.map((p, i) => (
          <div key={p.label} className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PIPE_DOT_COLORS[i] ?? "bg-[var(--charcoal)]/20"}`} />
            <span className="truncate text-[11px] text-[var(--charcoal)]/65 sm:text-xs">{p.label}</span>
            <span className="ml-auto font-display text-sm font-semibold text-[var(--charcoal)] sm:ml-0">{p.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--champagne)] bg-white px-6 py-10 text-center text-sm text-[var(--charcoal)]/50">
      {message}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
