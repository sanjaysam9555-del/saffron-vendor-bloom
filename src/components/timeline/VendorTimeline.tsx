import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Clock,
  ListChecks,
  AlertTriangle,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  Heart,
} from "lucide-react";
import { useAllCategories } from "@/lib/categories";

import {
  BUCKET_LABEL,
  BUCKET_TOKEN,
  classifyUrgency,
  daysBetween,
  daysLeftLabel,
  formatDueDate,
  sortItems,
  useNow,
  type Criticality,
  type TimelineItem,
} from "@/lib/urgency";
import {
  upsertCategoryDeadline,
  deleteCategoryDeadline,
} from "@/lib/project-deadlines.functions";
import {
  upsertProjectOtherExpense,
  deleteProjectOtherExpense,
} from "@/lib/project-other-expenses.functions";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";
import { useIsAdmin } from "@/lib/auth";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { formatINR } from "@/lib/quote-types";

const OTHER_PRESETS = ["Dhol Wala", "Heaters", "Coolers", "Transport", "Other expense"];

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
  /** Force the inner sub-view and hide the local toggle. */
  forcedSub?: SubView;
}

type SubView = "timeline" | "table";

export function VendorTimeline({ projectId, weddingDate, items, mode, registerRowRef, forcedSub }: Props) {
  const [subState, setSub] = useState<SubView>("timeline");
  const sub = forcedSub ?? subState;
  const [addOpen, setAddOpen] = useState(false);
  const [addOtherOpen, setAddOtherOpen] = useState(false);
  const now = useNow();
  // Vendor-only subset is still used for "missing deadline" badges and the
  // Add-Category duplicate check. Ribbon / horizontal / table all render the
  // full item list so "other" expenses appear alongside vendor categories.
  const vendorOnly = useMemo(() => items.filter((i) => i.kind !== "other"), [items]);
  const sorted = useMemo(() => sortItems(items, now), [items, now]);
  const unsetCount = vendorOnly.filter((i) => !i.due_date && !i.booked).length;
  const existingCategories = useMemo(() => vendorOnly.map((i) => i.category), [vendorOnly]);
  const existingOtherLabels = useMemo(
    () =>
      items.filter((i) => i.kind === "other").map((i) => i.category),
    [items],
  );


  return (
    <div className="mt-2">
      <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          {mode === "admin" && (
            <>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--terracotta)] bg-[var(--terracotta)] px-3 py-2 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 sm:w-auto sm:py-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Category To Plan
              </button>
              <button
                type="button"
                onClick={() => setAddOtherOpen(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs font-medium text-[var(--charcoal)]/80 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] sm:w-auto sm:py-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Other Expense
              </button>
            </>
          )}
          {!forcedSub && (
            <div
              role="tablist"
              className="col-span-2 inline-flex w-full overflow-hidden rounded-md border border-[var(--border)] bg-white text-xs sm:w-auto"
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
          )}
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
            ? "No categories yet. Assign vendors or use “Add Category To Plan” to start tracking deadlines."
            : "Your planner hasn't added any vendor categories yet."}
        </div>

      ) : sub === "timeline" ? (
        <>
          <div className="md:hidden">
            <TimelineRibbon
              items={sorted}
              projectId={projectId}
              mode={mode}
              weddingDate={weddingDate}
              now={now}
              registerRowRef={registerRowRef}
            />
          </div>
          <div className="hidden md:block">
            <HorizontalTimeline
              items={sorted}
              projectId={projectId}
              mode={mode}
              weddingDate={weddingDate}
              now={now}
              registerRowRef={registerRowRef}
            />
          </div>
        </>
      ) : (
        <TableView
          items={sorted}
          projectId={projectId}
          mode={mode}
          now={now}
          registerRowRef={registerRowRef}
          onAddOther={mode === "admin" ? () => setAddOtherOpen(true) : undefined}
        />
      )}

      {addOtherOpen && mode === "admin" && (
        <AddOtherExpenseDialog
          projectId={projectId}
          existingLabels={existingOtherLabels}
          onClose={() => setAddOtherOpen(false)}
        />
      )}

      {addOpen && (
        <AddCategoryDialog
          projectId={projectId}
          existing={existingCategories}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

function AddCategoryDialog({
  projectId,
  existing,
  onClose,
}: {
  projectId: string;
  existing: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertCategoryDeadline);
  const allCategories = useAllCategories();
  const existingSet = useMemo(
    () => new Set(existing.map((c) => c.toLowerCase())),
    [existing],
  );
  const available = allCategories;
  const [category, setCategory] = useState<string>(allCategories[0] ?? "");
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(allCategories.length === 0);
  const [due, setDue] = useState("");
  const [crit, setCrit] = useState<Criticality>("medium");
  const [planned, setPlanned] = useState("");

  const finalCategory = (useCustom ? custom : category).trim();
  const isDup = !!finalCategory && existingSet.has(finalCategory.toLowerCase());
  const canSave = finalCategory.length > 0 && !isDup;

  const saveM = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          project_id: projectId,
          category: finalCategory,
          due_date: due ? due : null,
          criticality: crit,
          notes: null,
          planned_amount: (() => {
            const n = Number(planned);
            return planned.trim() && Number.isFinite(n) && n >= 0 ? n : null;
          })(),
          actual_amount_override: null,
        },
      }),
    onSuccess: () => {
      notifySuccess("Category added");
      qc.invalidateQueries({ queryKey: ["project-deadlines", projectId] });
      onClose();
    },
    onError: (e: unknown) => notifyError(e, "Could not add category"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-[var(--cream)] p-5 text-[var(--charcoal)] shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg">Add Category To Plan</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[var(--cream-deep)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[var(--charcoal)]/65">Category</span>
            {!useCustom && available.length > 0 ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
              >
                {available.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="e.g. Wedding favours"
                className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
              />
            )}
            <button
              type="button"
              onClick={() => setUseCustom((v) => !v)}
              className="self-start text-[11px] text-[var(--terracotta)] hover:underline"
            >
              {useCustom ? "Pick from list" : "Type a custom name"}
            </button>
            {isDup && (
              <span className="text-[11px] text-red-600">
                This category is already on the plan.
              </span>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[var(--charcoal)]/65">Planned amount (₹, optional)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={planned}
              onChange={(e) => setPlanned(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--terracotta)]"
          >
            Cancel
          </button>
          <button
            onClick={() => saveM.mutate()}
            disabled={!canSave || saveM.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineRibbon({
  items,
  projectId,
  mode,
  weddingDate,
  now,
  registerRowRef,
}: {
  items: TimelineItem[];
  projectId: string;
  mode: "admin" | "client";
  weddingDate: string;
  now: Date;
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
}) {
  const sections = useMemo(() => {
    const overdue: TimelineItem[] = [];
    const upcoming: TimelineItem[] = [];
    const unscheduled: TimelineItem[] = [];
    const booked: TimelineItem[] = [];
    for (const it of items) {
      if (it.booked) booked.push(it);
      else if (!it.due_date) unscheduled.push(it);
      else if (classifyUrgency(it, now).bucket === "overdue") overdue.push(it);
      else upcoming.push(it);
    }
    const byDate = (a: TimelineItem, b: TimelineItem) =>
      (a.due_date ?? "").localeCompare(b.due_date ?? "");
    overdue.sort(byDate);
    upcoming.sort(byDate);
    booked.sort(byDate);
    unscheduled.sort((a, b) => a.category.localeCompare(b.category));
    return { overdue, upcoming, unscheduled, booked };
  }, [items, now]);

  const totals = useMemo(() => {
    const planned = sumAmounts(items, (i) => i.planned_amount);
    const actual = sumAmounts(items, (i) => resolveActual(i));
    return { planned, actual, variance: actual - planned };
  }, [items]);

  const weddingDays = daysBetween(now, new Date(weddingDate));

  // Continuous index for left/right alternation across scheduled rows only.
  let alt = 0;

  return (
    <div>
      <RibbonHeader weddingDate={weddingDate} daysToWedding={weddingDays} totals={totals} />

      <div className="relative">
        <div
          aria-hidden
          className="absolute top-4 bottom-4 w-px bg-[var(--champagne)]/60 left-[15px] md:left-1/2 md:-translate-x-1/2"
        />

        <div className="flex flex-col gap-10 py-2">
          {sections.overdue.map((item) => (
            <RibbonRow
              key={item.category}
              item={item}
              projectId={projectId}
              mode={mode}
              now={now}
              variant="overdue"
              side={alt++ % 2 === 0 ? "right" : "left"}
              registerRowRef={registerRowRef}
            />
          ))}

          {sections.upcoming.map((item) => (
            <RibbonRow
              key={item.category}
              item={item}
              projectId={projectId}
              mode={mode}
              now={now}
              variant="upcoming"
              side={alt++ % 2 === 0 ? "right" : "left"}
              registerRowRef={registerRowRef}
            />
          ))}

          {sections.unscheduled.length > 0 && (
            <UnscheduledBand
              items={sections.unscheduled}
              projectId={projectId}
              mode={mode}
              now={now}
              registerRowRef={registerRowRef}
            />
          )}

          {sections.booked.map((item) => (
            <RibbonRow
              key={item.category}
              item={item}
              projectId={projectId}
              mode={mode}
              now={now}
              variant="booked"
              side={alt++ % 2 === 0 ? "right" : "left"}
              registerRowRef={registerRowRef}
            />
          ))}

          <WeddingMarker date={weddingDate} />
        </div>
      </div>
    </div>
  );
}

function RibbonHeader({
  weddingDate,
  daysToWedding,
  totals,
}: {
  weddingDate: string;
  daysToWedding: number;
  totals: { planned: number; actual: number; variance: number };
}) {
  const varColor =
    totals.variance > 0
      ? "text-[var(--urgency-overdue)]"
      : totals.variance < 0
        ? "text-[var(--urgency-booked)]"
        : "text-[var(--charcoal)]/70";
  const absDays = Math.abs(daysToWedding);
  const dayLabel =
    daysToWedding > 0
      ? `day${daysToWedding === 1 ? "" : "s"} to go`
      : daysToWedding === 0
        ? "today"
        : `day${daysToWedding === -1 ? "" : "s"} ago`;
  return (
    <div className="mb-10 flex flex-col items-center gap-5 border-b border-[var(--champagne)]/50 pb-6 text-center md:flex-row md:items-end md:justify-between md:text-left">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--terracotta)]">
          Wedding Day: {formatDueDate(weddingDate)} —{" "}
          {daysToWedding === 0 ? (
            "Today"
          ) : (
            <>
              <FlipNumber value={absDays} /> {dayLabel}
            </>
          )}
        </p>
      </div>
      <div className="flex justify-center gap-6 text-center text-sm md:justify-end md:gap-8 md:text-right">
        <div>
          <p className="mb-0.5 text-[9px] uppercase tracking-wider text-[var(--charcoal)]/55">
            Planned
          </p>
          <p className="font-display text-xl text-[var(--charcoal)]">{formatINR(totals.planned)}</p>
        </div>
        <div>
          <p className="mb-0.5 text-[9px] uppercase tracking-wider text-[var(--charcoal)]/55">
            Actual
          </p>
          <p className="font-display text-xl text-[var(--charcoal)]">{formatINR(totals.actual)}</p>
        </div>
        <div>
          <p className="mb-0.5 text-[9px] uppercase tracking-wider text-[var(--charcoal)]/55">
            Variance
          </p>
          <p className={`font-display text-xl ${varColor}`}>
            {totals.variance >= 0 ? "+" : "−"}
            {formatINR(Math.abs(totals.variance))}
          </p>
        </div>
      </div>
    </div>
  );
}

type RibbonVariant = "overdue" | "upcoming" | "booked";

function RibbonRow({
  item,
  projectId,
  mode,
  now,
  variant,
  side,
  registerRowRef,
}: {
  item: TimelineItem;
  projectId: string;
  mode: "admin" | "client";
  now: Date;
  variant: RibbonVariant;
  side: "left" | "right";
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { daysLeft } = classifyUrgency(item, now);

  const accent =
    variant === "overdue"
      ? "var(--urgency-overdue)"
      : variant === "booked"
        ? "var(--urgency-booked)"
        : "var(--terracotta)";

  const pillLabel =
    variant === "overdue"
      ? "Overdue"
      : variant === "booked"
        ? "Booked"
        : item.criticality.toUpperCase();

  const subtitle =
    variant === "overdue" && daysLeft !== null
      ? daysLeftLabel(daysLeft)
      : variant === "upcoming" && daysLeft !== null
        ? daysLeftLabel(daysLeft)
        : variant === "booked"
          ? item.booked_vendor_name
            ? `with ${item.booked_vendor_name}`
            : "Vendor confirmed"
          : "";

  // Mobile: always card on the right of spine. md+: alternate.
  const cardOnRight = side === "right";

  return (
    <div className="relative grid grid-cols-1 items-center gap-4 md:grid-cols-2 md:gap-8">
      {/* Date side */}
      <div
        className={`hidden md:block ${cardOnRight ? "md:order-1 md:text-right md:pr-4" : "md:order-2 md:text-left md:pl-4"}`}
      >
        <DateLabel
          variant={variant}
          dueDate={item.due_date}
          subtitle={subtitle}
          accent={accent}
        />
      </div>

      {/* Spine dot */}
      <span
        aria-hidden
        className="pointer-events-none absolute z-10 h-3.5 w-3.5 rounded-full border-4 border-[var(--cream)] left-[15px] top-6 -translate-x-1/2 md:left-1/2 md:top-1/2 md:-translate-y-1/2"
        style={{
          background: variant === "upcoming" ? "var(--cream)" : accent,
          borderColor: "var(--cream)",
          boxShadow: variant === "upcoming" ? `inset 0 0 0 2px ${accent}` : undefined,
        }}
      />

      {/* Card side */}
      <div
        className={`pl-10 md:pl-0 ${cardOnRight ? "md:order-2 md:pl-4" : "md:order-1 md:pr-4"}`}
      >
        {/* On mobile, render compact date inline above card */}
        <div className="mb-2 md:hidden">
          <DateLabel
            variant={variant}
            dueDate={item.due_date}
            subtitle={subtitle}
            accent={accent}
            compact
          />
        </div>

        <article
          ref={(el) => registerRowRef?.(item.category, el as unknown as HTMLDivElement | null)}
          data-category={item.category}
          className={`rounded-lg bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md ${
            variant === "booked" ? "opacity-90 hover:opacity-100" : ""
          }`}
          style={{ borderLeft: `4px solid ${accent}` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-display text-lg leading-tight text-[var(--charcoal)]">
                {item.category}
              </h4>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--charcoal)]/55">
                {item.kind === "other" ? "Other expense" : `${item.vendor_count} shortlisted`}
                {item.notes ? ` · ${item.notes}` : ""}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{
                background:
                  variant === "overdue"
                    ? "var(--terracotta-soft)"
                    : variant === "booked"
                      ? "color-mix(in oklab, var(--urgency-booked) 12%, transparent)"
                      : item.criticality === "high"
                        ? "var(--criticality-high-bg)"
                        : item.criticality === "low"
                          ? "var(--criticality-low-bg)"
                          : "var(--criticality-med-bg)",
                color: variant === "booked" ? "var(--urgency-booked)" : accent,
              }}
            >
              {variant === "booked" && <CheckCircle2 className="mr-1 inline h-3 w-3 align-[-2px]" />}
              {pillLabel}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cream-deep)] pt-3 text-[11px]">
            <div className="flex gap-5">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-[var(--charcoal)]/45">
                  Planned
                </p>
                <p className="font-medium text-[var(--charcoal)]">
                  {item.planned_amount != null ? formatINR(item.planned_amount) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-[var(--charcoal)]/45">
                  Actual
                </p>
                <p className="font-medium text-[var(--charcoal)]">
                  {resolveActual(item) != null ? formatINR(resolveActual(item)) : "—"}
                  {item.actual_amount_override != null && (
                    <span className="ml-1 rounded bg-[var(--champagne)]/40 px-1 text-[8px] uppercase tracking-wider text-[var(--charcoal)]/70">
                      manual
                    </span>
                  )}
                </p>
              </div>
            </div>
            {mode === "admin" && (
              <button
                onClick={() => setEditing((e) => !e)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--charcoal)]/60 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
              >
                {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                {editing ? "Close" : "Edit"}
              </button>
            )}
          </div>

          {editing && mode === "admin" && (
            item.kind === "other" ? (
              <OtherExpenseEditor
                item={item}
                projectId={projectId}
                onDone={() => setEditing(false)}
              />
            ) : (
              <DeadlineEditor
                item={item}
                projectId={projectId}
                onDone={() => setEditing(false)}
              />
            )
          )}
        </article>
      </div>
    </div>
  );
}

function DateLabel({
  variant,
  dueDate,
  subtitle,
  accent,
  compact = false,
}: {
  variant: RibbonVariant;
  dueDate: string | null;
  subtitle: string;
  accent: string;
  compact?: boolean;
}) {
  const pill =
    variant === "overdue"
      ? "Overdue"
      : variant === "booked"
        ? "Completed"
        : "Upcoming";
  return (
    <div>
      <span
        className="inline-block rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white"
        style={{ background: accent }}
      >
        {pill}
      </span>
      <h3
        className={`font-display text-[var(--charcoal)] ${compact ? "mt-1 text-base" : "mt-2 text-2xl"}`}
      >
        {dueDate ? formatDueDate(dueDate) : "No deadline"}
      </h3>
      {subtitle && (
        <p
          className={`italic ${compact ? "text-[11px]" : "text-xs"} font-medium`}
          style={{ color: accent }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function UnscheduledBand({
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
  return (
    <div className="relative my-2">
      <div className="mb-6 flex items-center justify-center">
        <span className="z-10 bg-[var(--cream)] px-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--charcoal)]/45">
          To Be Scheduled
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 pl-10 md:grid-cols-2 md:pl-0">
        {items.map((item) => (
          <UnscheduledCard
            key={item.category}
            item={item}
            projectId={projectId}
            mode={mode}
            now={now}
            registerRowRef={registerRowRef}
          />
        ))}
      </div>
    </div>
  );
}

function UnscheduledCard({
  item,
  projectId,
  mode,
  registerRowRef,
}: {
  item: TimelineItem;
  projectId: string;
  mode: "admin" | "client";
  now: Date;
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
}) {
  const [editing, setEditing] = useState(false);
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
      className="flex flex-col justify-between rounded-lg border border-dashed border-[var(--champagne)]/70 bg-white/70 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-display text-base text-[var(--charcoal)]">{item.category}</h4>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${critClass}`}
        >
          {item.criticality}
        </span>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--charcoal)]/50">
        {item.kind === "other" ? "Other expense" : `${item.vendor_count} shortlisted`}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] italic font-medium text-[var(--terracotta)]">
          Set a deadline
        </p>
        {mode === "admin" && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="rounded-md p-1.5 text-[var(--charcoal)]/45 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]"
            aria-label="Edit deadline"
          >
            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {editing && mode === "admin" && (
        item.kind === "other" ? (
          <OtherExpenseEditor
            item={item}
            projectId={projectId}
            onDone={() => setEditing(false)}
          />
        ) : (
          <DeadlineEditor
            item={item}
            projectId={projectId}
            onDone={() => setEditing(false)}
          />
        )
      )}
    </div>
  );
}

function WeddingMarker({ date }: { date: string }) {
  return (
    <div className="relative mt-6 flex flex-col items-center">
      <div className="z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--terracotta)] text-[var(--cream)] shadow-lg">
        <Heart className="h-6 w-6" />
      </div>
      <div className="mt-4 text-center">
        <h3 className="font-display text-3xl italic text-[var(--charcoal)]">The Wedding Day</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--terracotta)]">
          {formatDueDate(date)}
        </p>
      </div>
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
    <div className="mt-3 rounded-md bg-[var(--cream)] p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[auto_auto_auto_auto_minmax(0,1fr)]">
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-[var(--charcoal)]/65">Due date</span>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-[var(--charcoal)]/65">Criticality</span>
          <select
            value={crit}
            onChange={(e) => setCrit(e.target.value as Criticality)}
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-[var(--charcoal)]/65">Planned Budget (₹)</span>
          <input
            type="number"
            min={0}
            step="1"
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
            placeholder="0"
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
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
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs sm:col-span-3 lg:col-span-1">
          <span className="text-[var(--charcoal)]/65">Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
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



function TableView({
  items,
  projectId,
  mode,
  now,
  registerRowRef,
  onAddOther,
}: {
  items: TimelineItem[];
  projectId: string;
  mode: "admin" | "client";
  now: Date;
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
  onAddOther?: () => void;
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
    <div className="space-y-2">
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
            {items.map((item) =>
              item.kind === "other" ? (
                <OtherTableRow
                  key={`other-${item.other_expense_id ?? item.category}`}
                  item={item}
                  projectId={projectId}
                  mode={mode}
                  now={now}
                  registerRowRef={registerRowRef}
                />
              ) : (
                <TableRow
                  key={item.category}
                  item={item}
                  projectId={projectId}
                  mode={mode}
                  now={now}
                  registerRowRef={registerRowRef}
                />
              ),
            )}
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
      {mode === "admin" && onAddOther && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAddOther}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--champagne)] bg-[var(--cream)]/40 px-3 py-1.5 text-xs text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add Other Expense
          </button>
        </div>
      )}
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

/* ============================================================
   Other Expense row + editor (table-only, non-vendor line items)
   ============================================================ */

function OtherTableRow({
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
        <td className="px-3 py-2">NA</td>
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
          <td colSpan={9} className="bg-[var(--cream)] px-3 py-2">
            <OtherExpenseEditor
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

function OtherExpenseEditor({
  item,
  projectId,
  onDone,
}: {
  item: TimelineItem;
  projectId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const confirmDelete = useConfirmDelete();
  const upsert = useServerFn(upsertProjectOtherExpense);
  const del = useServerFn(deleteProjectOtherExpense);
  const [label, setLabel] = useState(item.category);
  const [planned, setPlanned] = useState(
    item.planned_amount != null ? String(item.planned_amount) : "",
  );
  const [actual, setActual] = useState(
    item.closed_amount_auto != null ? String(item.closed_amount_auto) : "",
  );
  const [notes, setNotes] = useState(item.notes ?? "");
  const [crit, setCrit] = useState<Criticality>(item.criticality);
  const [due, setDue] = useState<string>(item.due_date ?? "");

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
          id: item.other_expense_id!,
          project_id: projectId,
          label: label.trim(),
          planned_amount: parseAmount(planned),
          actual_amount: parseAmount(actual),
          notes: notes.trim() ? notes.trim() : null,
          criticality: crit,
          due_date: due ? due : null,
        },
      }),
    onSuccess: () => {
      notifySuccess("Saved");
      qc.invalidateQueries({ queryKey: ["project-other-expenses", projectId] });
      onDone();
    },
    onError: (e) => notifyError(e, "Could not save"),
  });

  const deleteM = useMutation({
    mutationFn: () => del({ data: { id: item.other_expense_id! } }),
    onSuccess: () => {
      notifySuccess("Expense deleted");
      qc.invalidateQueries({ queryKey: ["project-other-expenses", projectId] });
      onDone();
    },
    onError: (e) => notifyError(e, "Could not delete"),
  });

  const canSave = label.trim().length > 0 && !saveM.isPending;

  return (
    <div className="rounded-md bg-[var(--cream)] p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs sm:col-span-1">
          <span className="text-[var(--charcoal)]/65">Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-[var(--charcoal)]/65">Due date</span>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-[var(--charcoal)]/65">Criticality</span>
          <select
            value={crit}
            onChange={(e) => setCrit(e.target.value as Criticality)}
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-[var(--charcoal)]/65">Planned (₹)</span>
          <input
            type="number"
            min={0}
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
            placeholder="0"
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-[var(--charcoal)]/65">Actual (₹)</span>
          <input
            type="number"
            min={0}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            placeholder="0"
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs sm:col-span-1">
          <span className="text-[var(--charcoal)]/65">Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <p className="mt-2 text-[11px] italic text-[var(--charcoal)]/55">
        Entering an actual amount marks this expense as booked.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          {isAdmin && item.other_expense_id && (
            <button
              onClick={async () => {
                const ok = await confirmDelete({
                  title: `Delete "${item.category}"?`,
                  description: "This expense will be removed from the project.",
                  confirmLabel: "Delete",
                });
                if (ok) deleteM.mutate();
              }}
              disabled={deleteM.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--charcoal)]/70 hover:border-red-500 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDone}
            className="rounded-md border border-[var(--border)] px-2 py-1.5 text-xs hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
          >
            Cancel
          </button>
          <button
            onClick={() => saveM.mutate()}
            disabled={!canSave}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            <Save className="h-3 w-3" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AddOtherExpenseDialog({
  projectId,
  existingLabels,
  onClose,
}: {
  projectId: string;
  existingLabels: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertProjectOtherExpense);
  const [label, setLabel] = useState("");
  const [planned, setPlanned] = useState("");
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState("");
  const [crit, setCrit] = useState<Criticality>("medium");
  const [due, setDue] = useState<string>("");

  const existingSet = useMemo(
    () => new Set(existingLabels.map((l) => l.toLowerCase().trim())),
    [existingLabels],
  );
  const trimmed = label.trim();
  const dup = trimmed !== "" && existingSet.has(trimmed.toLowerCase());

  const parseAmount = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const m = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          project_id: projectId,
          label: trimmed,
          planned_amount: parseAmount(planned),
          actual_amount: parseAmount(actual),
          notes: notes.trim() ? notes.trim() : null,
          sort_order: existingLabels.length,
          criticality: crit,
          due_date: due ? due : null,
        },
      }),
    onSuccess: () => {
      notifySuccess("Expense added");
      qc.invalidateQueries({ queryKey: ["project-other-expenses", projectId] });
      onClose();
    },
    onError: (e) => notifyError(e, "Could not add expense"),
  });

  const canSave = trimmed.length > 0 && !dup && !m.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base text-[var(--charcoal)]">Add other expense</h3>
          <button onClick={onClose} className="rounded-md p-1 text-[var(--charcoal)]/50 hover:bg-[var(--cream)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--charcoal)]/55">
          Non-vendor line items (e.g. Dhol Wala, Heaters, Transport). They appear alongside vendor categories on the timeline and in the budget table.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--charcoal)]/55">Quick:</span>
          {OTHER_PRESETS.filter((p) => !existingSet.has(p.toLowerCase())).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setLabel(p)}
              className="rounded-full border border-[var(--border)] bg-white px-2.5 py-0.5 text-[11px] text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[var(--charcoal)]/65">Label</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Heaters"
              className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
              autoFocus
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[var(--charcoal)]/65">Planned (₹)</span>
              <input
                type="number"
                min={0}
                value={planned}
                onChange={(e) => setPlanned(e.target.value)}
                placeholder="0"
                className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[var(--charcoal)]/65">Actual (₹)</span>
              <input
                type="number"
                min={0}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder="0"
                className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
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
              <span className="text-[var(--charcoal)]/65">Due date</span>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <p className="text-[11px] italic text-[var(--charcoal)]/55">
            Entering an actual amount marks this expense as booked.
          </p>
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
        </div>
        {dup && <p className="mt-2 text-[11px] text-red-600">An expense with this label already exists.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
          >
            Cancel
          </button>
          <button
            onClick={() => m.mutate()}
            disabled={!canSave}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   HorizontalTimeline (desktop) — month axis + compact cards
   ============================================================ */

function HorizontalTimeline({
  items,
  projectId,
  mode,
  weddingDate,
  now,
  registerRowRef,
}: {
  items: TimelineItem[];
  projectId: string;
  mode: "admin" | "client";
  weddingDate: string;
  now: Date;
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
}) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  const totals = useMemo(() => {
    const planned = sumAmounts(items, (i) => i.planned_amount);
    const actual = sumAmounts(items, (i) => resolveActual(i));
    return { planned, actual, variance: actual - planned };
  }, [items]);

  const onAxis = useMemo(
    () =>
      items
        .filter((i) => !!i.due_date)
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    [items],
  );
  const unscheduled = useMemo(
    () => items.filter((i) => !i.due_date && !i.booked),
    [items],
  );

  const wedding = new Date(weddingDate);
  const earliestTime = Math.min(
    now.getTime(),
    wedding.getTime(),
    ...onAxis.map((i) => new Date(i.due_date!).getTime()),
  );
  const earliest = new Date(earliestTime);
  const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const latestTime = Math.max(
    wedding.getTime(),
    ...onAxis.map((i) => new Date(i.due_date!).getTime()),
  );
  const latest = new Date(latestTime);
  const end = new Date(latest.getFullYear(), latest.getMonth() + 1, 0);

  const DAY_MS = 86400000;
  const totalDays = Math.max(30, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
  const pxPerDay = 6;
  const CARD_W = 180;
  const EDGE_PAD = CARD_W / 2 + 16;
  const width = Math.max(900, totalDays * pxPerDay + EDGE_PAD * 2);

  const months: Date[] = [];
  {
    const m = new Date(start);
    while (m <= end) {
      months.push(new Date(m));
      m.setMonth(m.getMonth() + 1);
    }
  }

  const xFor = (d: string | Date) =>
    ((new Date(d).getTime() - start.getTime()) / DAY_MS) * pxPerDay + EDGE_PAD;

  const AXIS_Y = 180;

  // Lane packing: alternate above/below, then pack into lanes so cards never overlap.
  const CARD_H = 118;
  const LANE_GAP = 14;
  const X_GAP = 12;
  type Placement = { item: TimelineItem; x: number; above: boolean; lane: number };
  const aboveLanes: number[] = []; // stores right-edge x of last card per lane
  const belowLanes: number[] = [];
  const placements: Placement[] = [];

  const weddingX = xFor(weddingDate);
  // Reserve a horizontal clear zone around the wedding heart + date label
  // so vendor cards on lane 0 never overlap the marker.
  const WEDDING_RESERVE = 60;
  const wReserveL = weddingX - WEDDING_RESERVE;
  const wReserveR = weddingX + WEDDING_RESERVE;

  onAxis.forEach((item, idx) => {
    const x = xFor(item.due_date!);
    const above = idx % 2 === 0;
    const lanes = above ? aboveLanes : belowLanes;
    const leftEdge = x - CARD_W / 2;
    const rightEdge = x + CARD_W / 2;
    const overlapsWedding = rightEdge > wReserveL && leftEdge < wReserveR;
    let lane = lanes.findIndex((rightX, laneIdx) => {
      if (rightX + X_GAP > leftEdge) return false;
      // lane 0 (closest to axis) stays clear under/over the wedding marker
      if (overlapsWedding && laneIdx === 0) return false;
      return true;
    });
    if (lane === -1) {
      lane = lanes.length;
      // If this is the very first card and it would land on lane 0 over the
      // wedding marker, bump it to lane 1 instead.
      if (overlapsWedding && lane === 0) {
        lanes.push(wReserveR); // mark lane 0 as occupied by the marker
        lane = 1;
      }
      lanes.push(rightEdge);
    } else {
      lanes[lane] = rightEdge;
    }
    placements.push({ item, x, above, lane });
  });

  const AXIS_TO_CARD = 28; // space between axis line and nearest card edge (room for month labels)
  const topPad = 24 + aboveLanes.length * (CARD_H + LANE_GAP) + AXIS_TO_CARD;
  const bottomPad = AXIS_TO_CARD + belowLanes.length * (CARD_H + LANE_GAP) + 24;
  const containerHeight = topPad + bottomPad;
  const axisY = topPad;

  const editingItem = editingCategory
    ? items.find((i) => i.category === editingCategory) ?? null
    : null;

  const todayX = xFor(now);

  return (
    <div>
      <RibbonHeader
        weddingDate={weddingDate}
        daysToWedding={daysBetween(now, wedding)}
        totals={totals}
      />

      <div className="overflow-x-auto rounded-md border border-[var(--champagne)]/40 bg-[var(--cream)]/40 shadow-[inset_-12px_0_8px_-8px_rgba(0,0,0,0.06)]">
        <div className="relative" style={{ width, height: containerHeight }}>
          {/* axis */}
          <div
            aria-hidden
            className="absolute left-0 right-0 h-px bg-[var(--champagne)]"
            style={{ top: axisY }}
          />

          {/* month ticks + labels */}
          {months.map((mm, idx) => {
            const x = xFor(mm);
            const showYear = mm.getMonth() === 0 || idx === 0;
            return (
              <div
                key={mm.toISOString()}
                className="absolute"
                style={{ left: x, top: axisY }}
              >
                <div className="h-2 w-px bg-[var(--champagne)]" />
                <div className="mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-[var(--charcoal)]/55">
                  {mm.toLocaleDateString(undefined, { month: "short" })}
                  {showYear ? ` '${String(mm.getFullYear()).slice(2)}` : ""}
                </div>
              </div>
            );
          })}

          {/* today marker */}
          {todayX >= 0 && todayX <= width && (
            <div
              className="absolute"
              style={{ left: todayX, top: 8, bottom: 8 }}
              aria-hidden
            >
              <div className="h-full w-px bg-[var(--terracotta)]/30" />
              <div className="absolute -translate-x-1/2 rounded-full bg-[var(--terracotta)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                   style={{ top: 0 }}>
                Today
              </div>
            </div>
          )}

          {/* wedding marker */}
          <div
            className="absolute z-20 flex flex-col items-center"
            style={{ left: weddingX, top: axisY - 22, transform: "translateX(-50%)" }}
          >
            <div className="z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--terracotta)] text-[var(--cream)] shadow-lg">
              <Heart className="h-5 w-5" />
            </div>
            <div className="mt-1 whitespace-nowrap rounded bg-[var(--cream)]/90 px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--terracotta)]">
              {formatDueDate(weddingDate)}
            </div>
          </div>

          {/* cards */}
          {placements.map(({ item, x, above, lane }) => {
            const variant: RibbonVariant = item.booked
              ? "booked"
              : classifyUrgency(item, now).bucket === "overdue"
                ? "overdue"
                : "upcoming";
            const laneOffset = lane * (CARD_H + LANE_GAP);
            const cardTop = above
              ? axisY - AXIS_TO_CARD - laneOffset - CARD_H
              : axisY + AXIS_TO_CARD + laneOffset;
            const connectorTop = above ? cardTop + CARD_H : axisY;
            const connectorHeight = above ? axisY - (cardTop + CARD_H) : cardTop - axisY;
            return (
              <div key={item.category}>
                {/* connector */}
                <div
                  aria-hidden
                  className="absolute w-px bg-[var(--champagne)]"
                  style={{ left: x, top: connectorTop, height: Math.max(0, connectorHeight) }}
                />
                {/* dot */}
                <span
                  aria-hidden
                  className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--cream)]"
                  style={{
                    left: x,
                    top: axisY,
                    background:
                      variant === "overdue"
                        ? "var(--urgency-overdue)"
                        : variant === "booked"
                          ? "var(--urgency-booked)"
                          : "var(--terracotta)",
                  }}
                />
                <HorizontalCard
                  item={item}
                  variant={variant}
                  now={now}
                  mode={mode}
                  onEdit={() =>
                    setEditingCategory((cur) =>
                      cur === item.category ? null : item.category,
                    )
                  }
                  isEditing={editingCategory === item.category}
                  registerRowRef={registerRowRef}
                  style={{
                    position: "absolute",
                    left: x - CARD_W / 2,
                    top: cardTop,
                    width: CARD_W,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* admin inline editor */}
      {mode === "admin" && editingItem && (
        <div className="mt-3 rounded-md border border-[var(--champagne)]/60 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-display text-base text-[var(--charcoal)]">
              {editingItem.category}
            </h4>
            <button
              onClick={() => setEditingCategory(null)}
              className="rounded-md p-1 text-[var(--charcoal)]/50 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]"
              aria-label="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {editingItem.kind === "other" ? (
            <OtherExpenseEditor
              item={editingItem}
              projectId={projectId}
              onDone={() => setEditingCategory(null)}
            />
          ) : (
            <DeadlineEditor
              item={editingItem}
              projectId={projectId}
              onDone={() => setEditingCategory(null)}
            />
          )}
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="mt-6">
          <UnscheduledBand
            items={unscheduled}
            projectId={projectId}
            mode={mode}
            now={now}
            registerRowRef={registerRowRef}
          />
        </div>
      )}
    </div>
  );
}

function HorizontalCard({
  item,
  variant,
  now,
  mode,
  onEdit,
  isEditing,
  registerRowRef,
  style,
}: {
  item: TimelineItem;
  variant: RibbonVariant;
  now: Date;
  mode: "admin" | "client";
  onEdit: () => void;
  isEditing: boolean;
  registerRowRef?: (category: string, el: HTMLDivElement | null) => void;
  style?: React.CSSProperties;
}) {
  const { daysLeft } = classifyUrgency(item, now);
  const accent =
    variant === "overdue"
      ? "var(--urgency-overdue)"
      : variant === "booked"
        ? "var(--urgency-booked)"
        : "var(--terracotta)";
  const pillLabel =
    variant === "overdue"
      ? "Overdue"
      : variant === "booked"
        ? "Booked"
        : item.criticality.toUpperCase();
  const pillBg =
    variant === "overdue"
      ? "var(--terracotta-soft)"
      : variant === "booked"
        ? "color-mix(in oklab, var(--urgency-booked) 12%, transparent)"
        : item.criticality === "high"
          ? "var(--criticality-high-bg)"
          : item.criticality === "low"
            ? "var(--criticality-low-bg)"
            : "var(--criticality-med-bg)";

  const subLine =
    variant === "booked"
      ? item.booked_vendor_name
        ? `with ${item.booked_vendor_name}`
        : "Confirmed"
      : daysLeft !== null
        ? daysLeftLabel(daysLeft)
        : "";

  return (
    <article
      ref={(el) => registerRowRef?.(item.category, el as unknown as HTMLDivElement | null)}
      data-category={item.category}
      style={style}
      className={`group rounded-md border border-[var(--champagne)]/70 bg-white p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-[var(--cream-deep)] transition-shadow hover:shadow-md hover:ring-[var(--champagne)] ${
        isEditing ? "ring-2 ring-[var(--terracotta)]" : ""
      } ${variant === "booked" ? "opacity-95" : ""} ${mode === "admin" ? "cursor-pointer" : ""}`}
      onClick={mode === "admin" ? onEdit : undefined}
    >
      <div
        className="mb-1.5 h-0.5 w-8 rounded-full"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-1.5">
        <h4 className="truncate font-display text-sm leading-tight text-[var(--charcoal)]">
          {item.category}
        </h4>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
          style={{ background: pillBg, color: variant === "booked" ? "var(--urgency-booked)" : accent }}
        >
          {variant === "booked" && <CheckCircle2 className="mr-0.5 inline h-2.5 w-2.5 align-[-1px]" />}
          {pillLabel}
        </span>
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--charcoal)]/70">
        {item.due_date ? formatDueDate(item.due_date) : "No date"}
      </p>
      {subLine && (
        <p className="text-[10px] italic" style={{ color: accent }}>
          {subLine}
        </p>
      )}
      <div className="mt-1.5 flex items-center justify-between border-t border-[var(--cream-deep)] pt-1.5">
        <span className="text-[9px] uppercase tracking-wider text-[var(--charcoal)]/45">
          {item.planned_amount != null ? formatINR(item.planned_amount) : "—"}
        </span>
        <span className="text-[9px] text-[var(--charcoal)]/45">
          {item.kind === "other" ? "Other expense" : `${item.vendor_count} shortlisted`}
        </span>
      </div>
    </article>
  );
}
