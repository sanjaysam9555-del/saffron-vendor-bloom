import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks,
  AlertTriangle,
  Pencil,
  Save,
  X,
} from "lucide-react";
import {
  BUCKET_LABEL,
  BUCKET_TOKEN,
  classifyUrgency,
  daysLeftLabel,
  formatDueDate,
  groupByBucket,
  sortItems,
  useNow,
  type Criticality,
  type TimelineItem,
  type UrgencyBucket,
} from "@/lib/urgency";
import {
  upsertCategoryDeadline,
  deleteCategoryDeadline,
} from "@/lib/project-deadlines.functions";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { formatINR } from "@/lib/quote-types";

function resolveActual(item: TimelineItem): number | null {
  return item.actual_amount_override ?? item.closed_amount_auto;
}

function sumAmounts(items: TimelineItem[], pick: (i: TimelineItem) => number | null): number {
  return items.reduce((s, i) => s + (pick(i) ?? 0), 0);
}

interface Props {
  projectId: string;
  weddingDate: string;
  items: TimelineItem[];
  mode: "admin" | "client";
  /** Optional ref for scroll-to from urgency strip. */
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
}

type SubView = "timeline" | "table";

export function VendorTimeline({ projectId, weddingDate, items, mode, registerRowRef }: Props) {
  const [sub, setSub] = useState<SubView>("timeline");
  const now = useNow();
  const grouped = useMemo(() => groupByBucket(items, now), [items, now]);
  const sorted = useMemo(() => sortItems(items, now), [items, now]);
  const unsetCount = items.filter((i) => !i.due_date && !i.booked).length;

  return (
    <div className="mt-2">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-[var(--terracotta)] sm:text-xl">Budget &amp; Deadlines</h2>
          <p className="mt-0.5 text-xs text-[var(--charcoal)]/65">
            Wedding day: {formatDueDate(weddingDate)}
          </p>
        </div>
        <div
          role="tablist"
          className="inline-flex w-full overflow-hidden rounded-md border border-[var(--border)] bg-white text-xs sm:w-auto"
        >
          <button
            role="tab"
            aria-selected={sub === "timeline"}
            onClick={() => setSub("timeline")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 sm:flex-none ${
              sub === "timeline"
                ? "bg-[var(--charcoal)] text-[var(--cream)]"
                : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Timeline
          </button>
          <button
            role="tab"
            aria-selected={sub === "table"}
            onClick={() => setSub("table")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 border-l border-[var(--border)] px-3 py-1.5 sm:flex-none ${
              sub === "table"
                ? "bg-[var(--charcoal)] text-[var(--cream)]"
                : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" /> Table
          </button>
        </div>
      </div>

      {mode === "admin" && unsetCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-[var(--champagne)]/60 bg-[var(--cream-deep)] px-3 py-2 text-xs text-[var(--charcoal)]/80">
          <AlertTriangle className="h-3.5 w-3.5 text-[var(--gold)]" />
          {unsetCount} categor{unsetCount === 1 ? "y has" : "ies have"} no deadline set yet.
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--champagne)] bg-[var(--cream)] py-10 text-center text-sm text-[var(--charcoal)]/60">
          {mode === "admin"
            ? "Assign vendors to this project to start tracking category deadlines."
            : "Your planner hasn't added any vendor categories yet."}
        </div>
      ) : sub === "timeline" ? (
        <div className="space-y-5">
          {grouped.map((g) => (
            <BucketGroup
              key={g.bucket}
              bucket={g.bucket}
              items={g.items}
              projectId={projectId}
              mode={mode}
              now={now}
              registerRowRef={registerRowRef}
            />
          ))}
          <TotalsRow items={items} />
        </div>
      ) : (
        <TableView
          items={sorted}
          projectId={projectId}
          mode={mode}
          now={now}
          registerRowRef={registerRowRef}
        />
      )}
    </div>
  );
}

function BucketGroup({
  bucket,
  items,
  projectId,
  mode,
  now,
  registerRowRef,
}: {
  bucket: UrgencyBucket;
  items: TimelineItem[];
  projectId: string;
  mode: "admin" | "client";
  now: Date;
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: BUCKET_TOKEN[bucket] }}
          aria-hidden
        />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--charcoal)]/70">
          {BUCKET_LABEL[bucket]} · {items.length}
        </h3>
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <CategoryRow
            key={item.category}
            item={item}
            projectId={projectId}
            mode={mode}
            now={now}
            registerRowRef={registerRowRef}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryRow({
  item,
  projectId,
  mode,
  now,
  registerRowRef,
}: {
  item: TimelineItem;
  projectId: string;
  mode: "admin" | "client";
  now: Date;
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { bucket, daysLeft } = classifyUrgency(item, now);
  const color = BUCKET_TOKEN[bucket];

  const critClass =
    item.criticality === "high"
      ? "bg-[var(--criticality-high-bg)] text-[var(--terracotta)]"
      : item.criticality === "low"
        ? "bg-[var(--criticality-low-bg)] text-[var(--charcoal)]/60"
        : "bg-[var(--criticality-med-bg)] text-[var(--charcoal)]/80";

  return (
    <div
      ref={(el) => registerRowRef?.(item.category, el)}
      data-category={item.category}
      className="relative rounded-lg border border-[var(--border)] bg-white p-3 pr-10 transition-shadow hover:shadow-sm sm:pr-3"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--charcoal)]">{item.category}</span>
            <span className="text-xs text-[var(--charcoal)]/55">
              · {item.vendor_count} shortlisted
            </span>
            {item.booked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sage)]/50 px-2 py-0.5 text-[10px] font-medium text-[var(--terracotta)]">
                <CheckCircle2 className="h-3 w-3" /> Booked
                {item.booked_vendor_name ? ` · ${item.booked_vendor_name}` : ""}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--charcoal)]/70">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {item.due_date ? formatDueDate(item.due_date) : "No deadline set"}
            </span>
            {daysLeft !== null && !item.booked && (
              <span style={{ color }} className="font-medium">
                {daysLeftLabel(daysLeft)}
              </span>
            )}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${critClass}`}>
              {item.criticality}
            </span>
            {item.notes && <span className="italic text-[var(--charcoal)]/55">— {item.notes}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--cream)] px-2 py-0.5 text-[var(--charcoal)]/75">
              Planned Budget:{" "}
              <span className="font-medium text-[var(--charcoal)]">
                {item.planned_amount != null ? formatINR(item.planned_amount) : "—"}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--cream)] px-2 py-0.5 text-[var(--charcoal)]/75">
              Actual Cost:{" "}
              <span className="font-medium text-[var(--charcoal)]">
                {resolveActual(item) != null ? formatINR(resolveActual(item)) : "—"}
              </span>
              {item.actual_amount_override != null && (
                <span className="ml-1 rounded bg-[var(--champagne)]/50 px-1 text-[9px] uppercase tracking-wide text-[var(--charcoal)]/70">
                  manual
                </span>
              )}
            </span>
          </div>
        </div>
        {mode === "admin" && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] sm:static"
          >
            {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
            <span className="hidden sm:inline">{editing ? "Close" : "Edit"}</span>
          </button>
        )}
      </div>

      {editing && mode === "admin" && (
        <DeadlineEditor
          item={item}
          projectId={projectId}
          onDone={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function DeadlineEditor({
  item,
  projectId,
  onDone,
}: {
  item: TimelineItem;
  projectId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertCategoryDeadline);
  const remove = useServerFn(deleteCategoryDeadline);
  const [due, setDue] = useState<string>(item.due_date ?? "");
  const [crit, setCrit] = useState<Criticality>(item.criticality);
  const [notes, setNotes] = useState<string>(item.notes ?? "");
  const [planned, setPlanned] = useState<string>(
    item.planned_amount != null ? String(item.planned_amount) : "",
  );
  const [actualOverride, setActualOverride] = useState<string>(
    item.actual_amount_override != null ? String(item.actual_amount_override) : "",
  );

  const queryKey = ["project-deadlines", projectId] as const;

  type DeadlineRow = {
    id: string;
    project_id: string;
    category: string;
    due_date: string | null;
    criticality: Criticality;
    notes: string | null;
    planned_amount: number | null;
    actual_amount_override: number | null;
    updated_at: string;
  };

  const parseAmount = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const saveM = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          project_id: projectId,
          category: item.category,
          due_date: due ? due : null,
          criticality: crit,
          notes: notes.trim() ? notes.trim() : null,
          planned_amount: parseAmount(planned),
          actual_amount_override: parseAmount(actualOverride),
        },
      }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<DeadlineRow[]>(queryKey) ?? [];
      const next: DeadlineRow[] = (() => {
        const optimistic: DeadlineRow = {
          id: prev.find((r) => r.category === item.category)?.id ?? `optimistic-${item.category}`,
          project_id: projectId,
          category: item.category,
          due_date: due ? due : null,
          criticality: crit,
          notes: notes.trim() ? notes.trim() : null,
          planned_amount: parseAmount(planned),
          actual_amount_override: parseAmount(actualOverride),
          updated_at: new Date().toISOString(),
        };
        const idx = prev.findIndex((r) => r.category === item.category);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = optimistic;
          return copy;
        }
        return [...prev, optimistic];
      })();
      qc.setQueryData<DeadlineRow[]>(queryKey, next);
      onDone();
      return { prev };
    },
    onError: (e: unknown, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      notifyError(e, "Could not save");
    },
    onSuccess: () => notifySuccess("Saved"),
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const clearM = useMutation({
    mutationFn: () =>
      remove({ data: { project_id: projectId, category: item.category } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<DeadlineRow[]>(queryKey) ?? [];
      qc.setQueryData<DeadlineRow[]>(
        queryKey,
        prev.filter((r) => r.category !== item.category),
      );
      onDone();
      return { prev };
    },
    onError: (e: unknown, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      notifyError(e, "Could not clear");
    },
    onSuccess: () => notifySuccess("Cleared"),
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const autoActual = item.closed_amount_auto;

  return (
    <div className="mt-3 grid gap-2 rounded-md bg-[var(--cream)] p-3 sm:grid-cols-[auto_auto_auto_auto_1fr_auto]">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--charcoal)]/65">Due date</span>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--charcoal)]/65">Criticality</span>
        <select
          value={crit}
          onChange={(e) => setCrit(e.target.value as Criticality)}
          className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--charcoal)]/65">Planned Budget (₹)</span>
        <input
          type="number"
          min={0}
          step="1"
          value={planned}
          onChange={(e) => setPlanned(e.target.value)}
          placeholder="0"
          className="w-32 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--charcoal)]/65">
          Actual Cost(₹)
        </span>
        <input
          type="number"
          min={0}
          step="1"
          value={actualOverride}
          onChange={(e) => setActualOverride(e.target.value)}
          placeholder={autoActual != null ? `auto ${autoActual}` : "—"}
          className="w-36 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--charcoal)]/65">Notes</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
          className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex w-full items-end justify-end gap-2 sm:w-auto">
        <button
          onClick={() => saveM.mutate()}
          disabled={saveM.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          <Save className="h-3 w-3" /> Save
        </button>
        {(item.due_date ||
          item.notes ||
          item.criticality !== "medium" ||
          item.planned_amount != null ||
          item.actual_amount_override != null) && (
          <button
            onClick={() => clearM.mutate()}
            disabled={clearM.isPending}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1.5 text-xs hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:opacity-60"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function TotalsRow({ items }: { items: TimelineItem[] }) {
  const planned = sumAmounts(items, (i) => i.planned_amount);
  const actual = sumAmounts(items, (i) => resolveActual(i));
  const variance = actual - planned;
  const varColor =
    variance > 0
      ? "text-[var(--terracotta)]"
      : variance < 0
        ? "text-emerald-700"
        : "text-[var(--charcoal)]/70";
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 rounded-md border border-[var(--border)] bg-[var(--cream)] px-4 py-2.5 text-sm">
      <span className="text-xs uppercase tracking-wider text-[var(--charcoal)]/60">
        Totals
      </span>
      <span className="text-[var(--charcoal)]/75">
        Planned Budget: <span className="font-semibold text-[var(--charcoal)]">{formatINR(planned)}</span>
      </span>
      <span className="text-[var(--charcoal)]/75">
        Actual Cost: <span className="font-semibold text-[var(--charcoal)]">{formatINR(actual)}</span>
      </span>
      <span className={`font-medium ${varColor}`}>
        Variance: {variance >= 0 ? "+" : "−"}
        {formatINR(Math.abs(variance))}
      </span>
    </div>
  );
}

function TableView({
  items,
  projectId,
  mode,
  now,
  registerRowRef,
}: {
  items: TimelineItem[];
  projectId: string;
  mode: "admin" | "client";
  now: Date;
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
}) {
  const totalPlanned = sumAmounts(items, (i) => i.planned_amount);
  const totalActual = sumAmounts(items, (i) => resolveActual(i));
  const variance = totalActual - totalPlanned;
  const varColor =
    variance > 0
      ? "text-[var(--terracotta)]"
      : variance < 0
        ? "text-emerald-700"
        : "text-[var(--charcoal)]/70";
  const colSpan = mode === "admin" ? 9 : 8;
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)] shadow-[inset_-12px_0_8px_-8px_rgba(0,0,0,0.08)]">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-[var(--cream)] text-left text-xs uppercase tracking-wider text-[var(--charcoal)]/60">
          <tr>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Vendors</th>
            <th className="px-3 py-2">Due date</th>
            <th className="px-3 py-2">Days left</th>
            <th className="px-3 py-2">Criticality</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Planned Budget</th>
            <th className="px-3 py-2 text-right">Actual Cost</th>
            {mode === "admin" && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <TableRow
              key={item.category}
              item={item}
              projectId={projectId}
              mode={mode}
              now={now}
              registerRowRef={registerRowRef}
            />
          ))}
        </tbody>
        <tfoot className="bg-[var(--cream)] text-sm">
          <tr className="border-t-2 border-[var(--border)]">
            <td className="px-3 py-2 font-semibold uppercase tracking-wider text-xs text-[var(--charcoal)]/70" colSpan={6}>
              Totals
            </td>
            <td className="px-3 py-2 text-right font-semibold">{formatINR(totalPlanned)}</td>
            <td className="px-3 py-2 text-right font-semibold">{formatINR(totalActual)}</td>
            {mode === "admin" && <td className="px-3 py-2" />}
          </tr>
          <tr>
            <td className={`px-3 pb-2 text-right text-xs font-medium ${varColor}`} colSpan={colSpan}>
              Variance: {variance >= 0 ? "+" : "−"}
              {formatINR(Math.abs(variance))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TableRow({
  item,
  projectId,
  mode,
  now,
  registerRowRef,
}: {
  item: TimelineItem;
  projectId: string;
  mode: "admin" | "client";
  now: Date;
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { bucket, daysLeft } = classifyUrgency(item, now);
  const color = BUCKET_TOKEN[bucket];
  const actual = resolveActual(item);

  return (
    <>
      <tr
        ref={(el) =>
          registerRowRef?.(item.category, el as unknown as HTMLDivElement | null)
        }
        data-category={item.category}
        className="border-t border-[var(--border)]"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <td className="px-3 py-2 font-medium">{item.category}</td>
        <td className="px-3 py-2">{item.vendor_count}</td>
        <td className="px-3 py-2">{item.due_date ? formatDueDate(item.due_date) : "—"}</td>
        <td className="px-3 py-2" style={{ color }}>
          {item.booked ? "—" : daysLeft === null ? "—" : daysLeftLabel(daysLeft)}
        </td>
        <td className="px-3 py-2 capitalize">{item.criticality}</td>
        <td className="px-3 py-2">
          {item.booked ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Booked
            </span>
          ) : (
            BUCKET_LABEL[bucket]
          )}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {item.planned_amount != null ? formatINR(item.planned_amount) : "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {actual != null ? formatINR(actual) : "—"}
          {item.actual_amount_override != null && (
            <span className="ml-1 rounded bg-[var(--champagne)]/50 px-1 text-[9px] uppercase tracking-wide text-[var(--charcoal)]/70">
              manual
            </span>
          )}
        </td>
        {mode === "admin" && (
          <td className="px-3 py-2 text-right">
            <button
              onClick={() => setEditing((e) => !e)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              {editing ? "Close" : "Edit"}
            </button>
          </td>
        )}
      </tr>
      {editing && mode === "admin" && (
        <tr>
          <td colSpan={mode === "admin" ? 9 : 8} className="bg-[var(--cream)] px-3 py-2">
            <DeadlineEditor
              item={item}
              projectId={projectId}
              onDone={() => setEditing(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}
