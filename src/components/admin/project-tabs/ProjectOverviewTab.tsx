import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, AlertTriangle, MessageSquare } from "lucide-react";
import { listProjectTasks } from "@/lib/project-tasks.functions";
import { PriorityChip } from "./tasks/task-meta";
import { listProjectGuests } from "@/lib/project-guests.functions";
import { getProjectBudgetSummary } from "@/lib/project-budget.functions";
import { listProjectQuotesAllVendors } from "@/lib/quote-api";
import { listProjectCategoryDeadlines } from "@/lib/project-deadlines.functions";
import { listProjectCommentsAllVendors } from "@/lib/projects.functions";
import { formatINRShort } from "@/lib/quote-types";

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86400_000);
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  const d = Math.floor(s / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/**
 * At-a-glance summary tab. Pulls from the same data sources the other tabs
 * own (tasks, guests, budget, quotes, deadlines, comments) rather than
 * computing anything new — this is a dashboard on top of them. Query keys
 * match those tabs' exactly, so visiting either warms the other's cache.
 */
export function ProjectOverviewTab({
  projectId,
  vendorCount,
  onOpenVendor,
}: {
  projectId: string;
  vendorCount: number;
  onOpenVendor?: (vendorId: string) => void;
}) {
  const tasksQ = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => listProjectTasks({ data: { project_id: projectId } }),
  });
  const guestsQ = useQuery({
    queryKey: ["project-guests", projectId],
    queryFn: () => listProjectGuests({ data: { project_id: projectId } }),
  });
  const budgetQ = useQuery({
    queryKey: ["project-budget", projectId],
    queryFn: () => getProjectBudgetSummary({ data: { project_id: projectId } }),
  });
  const quotesQ = useQuery({
    queryKey: ["project-quotes-all", projectId],
    queryFn: () => listProjectQuotesAllVendors(projectId),
  });
  const deadlinesQ = useQuery({
    queryKey: ["project-deadlines", projectId],
    queryFn: () => listProjectCategoryDeadlines({ data: { project_id: projectId } }),
  });
  const commentsQ = useQuery({
    queryKey: ["project-comments-all", projectId],
    queryFn: () => listProjectCommentsAllVendors({ data: { project_id: projectId } }),
  });

  const tasks = tasksQ.data ?? [];
  const guests = guestsQ.data ?? [];
  const budget = budgetQ.data;
  const deadlines = deadlinesQ.data ?? [];
  const comments = commentsQ.data ?? [];

  const finalisedVendorCount = useMemo(
    () => new Set((quotesQ.data ?? []).filter((q) => q.is_final || q.status === "closed").map((q) => q.vendor_id)).size,
    [quotesQ.data],
  );

  const closedCategoryCount = budget?.categories.filter((c) => c.actualClosed > 0).length ?? 0;
  const totalCategoryCount = budget?.categories.length ?? 0;

  const openTasks = tasks.filter((t) => !t.done);
  const rsvpYes = guests.filter((g) => g.rsvp_status === "yes").length;

  const urgentCategories = useMemo(
    () =>
      deadlines
        .filter((d) => d.due_date)
        .map((d) => ({ ...d, d: daysUntil(d.due_date!) }))
        .filter((d) => d.d <= 45)
        .sort((a, b) => a.d - b.d)
        .slice(0, 6),
    [deadlines],
  );

  const recentComments = useMemo(() => [...comments].reverse().slice(0, 5), [comments]);

  return (
    <div className="space-y-6">
      {/* ── Stat row ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Total budget"
          value={budget ? formatINRShort(budget.actual) : "—"}
          hint={budget ? `of ${formatINRShort(budget.planned)} planned` : undefined}
        />
        <StatCard
          label="Total paid"
          value={budget ? formatINRShort(budget.paid) : "—"}
          hint={budget && budget.actual > 0 ? `${Math.round((budget.paid / budget.actual) * 100)}% of closed` : undefined}
        />
        <StatCard
          label="Categories closed"
          value={`${closedCategoryCount}/${totalCategoryCount}`}
          hint="vendor categories"
        />
        <StatCard
          label="Vendors confirmed"
          value={`${finalisedVendorCount}/${vendorCount}`}
          hint="across all categories"
        />
        <StatCard
          label="RSVP"
          value={`${rsvpYes}/${guests.length}`}
          hint={guests.length > 0 ? `${guests.filter((g) => g.rsvp_status === "pending").length} pending` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Open tasks ── */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <CheckSquare className="h-4 w-4 text-[var(--terracotta)]" />
            <h3 className="font-display text-lg text-[var(--charcoal)]">Open tasks</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {tasksQ.isLoading ? (
              <div className="p-4 text-sm text-[var(--charcoal)]/66">Loading…</div>
            ) : openTasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--charcoal)]/62">Nothing open — all caught up.</div>
            ) : (
              openTasks.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm text-[var(--charcoal)]">{t.title}</span>
                  <PriorityChip priority={t.priority} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Upcoming urgent categories ── */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-[var(--terracotta)]" />
            <h3 className="font-display text-lg text-[var(--charcoal)]">Upcoming urgent categories</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {deadlinesQ.isLoading ? (
              <div className="p-4 text-sm text-[var(--charcoal)]/66">Loading…</div>
            ) : urgentCategories.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--charcoal)]/62">Nothing urgent right now.</div>
            ) : (
              urgentCategories.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm text-[var(--charcoal)]">{d.category}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      d.d < 0 ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)]" : "bg-[var(--gold-soft)] text-[hsl(38_45%_28%)]"
                    }`}
                  >
                    {d.d < 0 ? `${Math.abs(d.d)}d overdue` : `${d.d}d`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Budget by category ── */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h3 className="font-display text-lg text-[var(--charcoal)]">Budget by category</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {budgetQ.isLoading ? (
              <div className="p-4 text-sm text-[var(--charcoal)]/66">Loading…</div>
            ) : !budget || budget.categories.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--charcoal)]/62">No categories yet.</div>
            ) : (
              budget.categories.map((c) => {
                const pct = c.planned > 0 ? Math.min(100, Math.round((c.actualClosed / c.planned) * 100)) : c.actualClosed > 0 ? 100 : 0;
                return (
                  <div key={c.category} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[var(--charcoal)]/75">{c.category}</span>
                      <span className="text-[var(--charcoal)]/62">
                        {formatINRShort(c.actualClosed)} / {formatINRShort(c.planned)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--cream-deep)]">
                      <div className="h-full rounded-full bg-[var(--terracotta)]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Recent comments ── */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <MessageSquare className="h-4 w-4 text-[var(--terracotta)]" />
            <h3 className="font-display text-lg text-[var(--charcoal)]">Recent comments</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {commentsQ.isLoading ? (
              <div className="p-4 text-sm text-[var(--charcoal)]/66">Loading…</div>
            ) : recentComments.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--charcoal)]/62">No comments yet.</div>
            ) : (
              recentComments.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onOpenVendor?.(c.vendor_id)}
                  disabled={!onOpenVendor}
                  className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--cream)]/50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-[var(--terracotta)]">{c.vendor_name}</div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-[var(--charcoal)]">{c.body}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-[var(--charcoal)]/58">{timeAgo(c.created_at)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="font-display text-2xl font-semibold leading-tight text-[var(--charcoal)]">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-[var(--charcoal)]/66">{hint}</div>}
      <div className="mt-auto pt-3 text-[10px] font-medium uppercase tracking-widest text-[var(--charcoal)]/70">{label}</div>
    </div>
  );
}

export function PriorityPill({ priority }: { priority: "low" | "medium" | "high" }) {
  const cls =
    priority === "high"
      ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
      : priority === "medium"
        ? "bg-[var(--gold-soft)] text-[hsl(38_45%_28%)]"
        : "bg-[var(--cream-deep)] text-[var(--charcoal)]/70";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {priority}
    </span>
  );
}
