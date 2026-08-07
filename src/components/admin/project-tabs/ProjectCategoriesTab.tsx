import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";
import {
  listProjectCategoryDeadlines,
  upsertCategoryDeadline,
  type Criticality,
} from "@/lib/project-deadlines.functions";
import { listProjectOtherExpenses } from "@/lib/project-other-expenses.functions";
import { getProjectBudgetSummary } from "@/lib/project-budget.functions";
import { AddCategoryDialog, AddOtherExpenseDialog } from "@/components/timeline/VendorTimeline";
import { formatINRShort } from "@/lib/quote-types";
import { notifyError } from "@/lib/ui/feedback";

const CRIT_DOT: Record<Criticality, string> = {
  high: "bg-[var(--terracotta)]",
  medium: "bg-[var(--gold)]",
  low: "bg-[var(--charcoal)]/30",
};

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86400_000);
}

/**
 * Merged Deadlines + Budget tab. The urgency strip and table are the old
 * Deadlines tab verbatim, with a Paid column added from the budget rollup.
 * "Add Category To Plan" / "Add Other Expense" moved here from the Timeline
 * tab — this is where category-level planning actually happens now.
 */
export function ProjectCategoriesTab({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const key = ["project-deadlines", projectId];
  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listProjectCategoryDeadlines({ data: { project_id: projectId } }),
  });
  const { data: otherExpenses = [] } = useQuery({
    queryKey: ["project-other-expenses", projectId],
    queryFn: () => listProjectOtherExpenses({ data: { project_id: projectId } }),
  });
  const { data: budget } = useQuery({
    queryKey: ["project-budget", projectId],
    queryFn: () => getProjectBudgetSummary({ data: { project_id: projectId } }),
  });
  const byCategory = useMemo(
    () => new Map((budget?.categories ?? []).map((c) => [c.category, c])),
    [budget],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [addOtherOpen, setAddOtherOpen] = useState(false);

  const save = useMutation({
    mutationFn: (input: {
      category: string;
      due_date: string | null;
      criticality: Criticality;
      notes?: string | null;
      planned_amount?: number | null;
    }) => upsertCategoryDeadline({ data: { project_id: projectId, ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => notifyError(e, "Could not save"),
  });

  const urgent = useMemo(
    () =>
      rows
        .filter((r) => r.due_date)
        .map((r) => ({ ...r, d: daysUntil(r.due_date!) }))
        .filter((r) => r.d <= 45)
        .sort((a, b) => a.d - b.d)
        .slice(0, 6),
    [rows],
  );

  return (
    <div className="space-y-4">
      {/* ── Actions ── */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--terracotta)] bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Category To Plan
          </button>
          <button
            onClick={() => setAddOtherOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--charcoal)]/80 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add Other Expense
          </button>
        </div>
      )}

      {urgent.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/62">
            <AlertTriangle className="h-3 w-3 text-[var(--terracotta)]" /> Urgency
          </div>
          <div className="flex flex-wrap gap-2">
            {urgent.map((r) => (
              <span
                key={r.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  r.d < 0 ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)]" : "bg-[var(--gold-soft)] text-[hsl(38_45%_28%)]"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${CRIT_DOT[r.criticality]}`} />
                {r.category} · {r.d < 0 ? `${Math.abs(r.d)}d overdue` : `${r.d}d`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
              <tr>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Due</th>
                <th className="px-4 py-2.5">Criticality</th>
                <th className="px-4 py-2.5 text-right">Planned</th>
                <th className="px-4 py-2.5 text-right">Actual</th>
                <th className="px-4 py-2.5 text-right">Paid</th>
                {isAdmin && <th className="px-4 py-2.5">Notes</th>}
              </tr>
            </thead>
            <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--charcoal)]/66">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--charcoal)]/62">No category deadlines set.</td></tr>
              ) : (
                rows.map((r) => (
                  <CategoryRow
                    key={r.id}
                    row={r}
                    budgetRow={byCategory.get(r.category)}
                    isAdmin={isAdmin}
                    onSave={(patch) =>
                      save.mutate({
                        category: r.category,
                        due_date: r.due_date,
                        criticality: r.criticality,
                        notes: r.notes,
                        planned_amount: r.planned_amount,
                        ...patch,
                      })
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <AddCategoryDialog
          projectId={projectId}
          existing={rows.map((r) => r.category)}
          onClose={() => setAddOpen(false)}
        />
      )}
      {addOtherOpen && (
        <AddOtherExpenseDialog
          projectId={projectId}
          existingLabels={otherExpenses.map((e: any) => e.label)}
          onClose={() => setAddOtherOpen(false)}
        />
      )}
    </div>
  );
}

function CategoryRow({
  row,
  budgetRow,
  isAdmin,
  onSave,
}: {
  row: {
    id: string;
    category: string;
    due_date: string | null;
    criticality: Criticality;
    notes?: string | null;
    planned_amount: number | null;
    actual_amount_override: number | null;
  };
  budgetRow?: { actualClosed: number; paid: number };
  isAdmin: boolean;
  onSave: (patch: Partial<{ due_date: string | null; criticality: Criticality; notes: string | null; planned_amount: number | null }>) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(row.notes ?? "");
  const isOverride = row.actual_amount_override != null;
  const actual = isOverride ? row.actual_amount_override! : (budgetRow?.actualClosed ?? 0);
  const paid = budgetRow?.paid ?? 0;

  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-4 py-2.5 font-medium text-[var(--charcoal)]">{row.category}</td>
      <td className="px-4 py-2.5">
        {isAdmin ? (
          <input
            type="date"
            defaultValue={row.due_date ?? ""}
            onBlur={(e) => onSave({ due_date: e.target.value || null })}
            className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-[var(--border)] focus:border-[var(--terracotta)] focus:outline-none"
          />
        ) : (
          <span className="text-[var(--charcoal)]/82">
            {row.due_date ? new Date(row.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {isAdmin ? (
          <select
            defaultValue={row.criticality}
            onChange={(e) => onSave({ criticality: e.target.value as Criticality })}
            className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs capitalize hover:border-[var(--border)] focus:border-[var(--terracotta)] focus:outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[var(--charcoal)]/82 capitalize">
            <span className={`h-1.5 w-1.5 rounded-full ${CRIT_DOT[row.criticality]}`} />
            {row.criticality}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-[var(--charcoal)]/82">
        {row.planned_amount ? formatINRShort(row.planned_amount) : "—"}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="text-[var(--charcoal)]">{actual > 0 ? formatINRShort(actual) : "₹0"}</span>
        {isOverride && (
          <span className="ml-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--terracotta)]">override</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-medium text-[hsl(38_45%_28%)]">
        {paid > 0 ? formatINRShort(paid) : "₹0"}
      </td>
      {isAdmin && (
        <td className="px-4 py-2.5">
          {notesOpen ? (
            <input
              autoFocus
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => {
                setNotesOpen(false);
                onSave({ notes: notesDraft.trim() || null });
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full rounded border border-[var(--terracotta)] bg-white px-1.5 py-0.5 text-xs focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setNotesOpen(true)}
              className="text-left text-xs italic text-[var(--charcoal)]/62 hover:text-[var(--terracotta)]"
            >
              {row.notes || "click to edit"}
            </button>
          )}
        </td>
      )}
    </tr>
  );
}
