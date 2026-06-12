import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Save, Trash2, Wallet } from "lucide-react";

import {
  listProjectOtherExpenses,
  upsertProjectOtherExpense,
  deleteProjectOtherExpense,
  type OtherExpense,
} from "@/lib/project-other-expenses.functions";
import { formatINR } from "@/lib/quote-types";
import { notifyError, notifySuccess } from "@/lib/ui/feedback";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";
import { useIsAdmin } from "@/lib/auth";

interface Props {
  projectId: string;
  mode: "admin" | "client";
}

const QUICK_PRESETS = ["Dhol Wala", "Heaters", "Coolers", "Transport", "Other expense"];

export function OtherExpensesPanel({ projectId, mode }: Props) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["project-other-expenses", projectId], [projectId]);
  const listFn = useServerFn(listProjectOtherExpenses);

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { project_id: projectId } }),
  });

  const totalPlanned = rows.reduce((s, r) => s + (r.planned_amount ?? 0), 0);
  const totalActual = rows.reduce((s, r) => s + (r.actual_amount ?? 0), 0);

  if (mode === "client" && !isLoading && rows.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--terracotta-soft)] text-[var(--terracotta)]">
            <Wallet className="h-3.5 w-3.5" />
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-[var(--charcoal)]/75">
              Other expenses
            </h3>
            <p className="text-[11px] text-[var(--charcoal)]/55">
              Non-vendor line items (e.g. Dhol Wala, Heaters, Transport). Not on the timeline.
            </p>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="hidden text-right text-xs text-[var(--charcoal)]/60 sm:block">
            <div>Planned <span className="font-semibold text-[var(--charcoal)]">{formatINR(totalPlanned)}</span></div>
            <div>Actual <span className="font-semibold text-[var(--charcoal)]">{formatINR(totalActual)}</span></div>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--champagne)] bg-[var(--cream)]/40 px-3 py-4 text-center text-xs text-[var(--charcoal)]/55">
          No other expenses yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-[var(--cream)] text-left text-[10px] uppercase tracking-wider text-[var(--charcoal)]/60">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2 text-right">Planned (₹)</th>
                <th className="px-3 py-2 text-right">Actual (₹)</th>
                {mode === "admin" && <th className="px-3 py-2">Notes</th>}
                {mode === "admin" && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                mode === "admin" ? (
                  <AdminRow key={row.id} row={row} projectId={projectId} queryKey={queryKey} />
                ) : (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">{row.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.planned_amount != null ? formatINR(row.planned_amount) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.actual_amount != null ? formatINR(row.actual_amount) : "—"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot className="bg-[var(--cream)] text-sm">
              <tr className="border-t-2 border-[var(--border)]">
                <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--charcoal)]/70">
                  Totals
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatINR(totalPlanned)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatINR(totalActual)}</td>
                {mode === "admin" && <td className="px-3 py-2" />}
                {mode === "admin" && <td className="px-3 py-2" />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {mode === "admin" && <AddRow projectId={projectId} queryKey={queryKey} existing={rows} />}
    </section>
  );
}

function AddRow({
  projectId,
  queryKey,
  existing,
}: {
  projectId: string;
  queryKey: readonly unknown[];
  existing: OtherExpense[];
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertProjectOtherExpense);
  const [label, setLabel] = useState("");
  const [planned, setPlanned] = useState("");
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState("");

  const existingLabels = useMemo(
    () => new Set(existing.map((e) => e.label.toLowerCase().trim())),
    [existing],
  );

  const m = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          project_id: projectId,
          label: label.trim(),
          planned_amount: planned === "" ? null : Number(planned),
          actual_amount: actual === "" ? null : Number(actual),
          notes: notes.trim() === "" ? null : notes.trim(),
          sort_order: existing.length,
        },
      }),
    onSuccess: () => {
      setLabel("");
      setPlanned("");
      setActual("");
      setNotes("");
      notifySuccess("Expense added");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e) => notifyError(e, "Could not add expense"),
  });

  const trimmed = label.trim();
  const dup = trimmed !== "" && existingLabels.has(trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !dup && !m.isPending;

  return (
    <div className="mt-4 rounded-md border border-dashed border-[var(--champagne)] bg-[var(--cream)]/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-[var(--charcoal)]/55">
          Quick add:
        </span>
        {QUICK_PRESETS.filter((p) => !existingLabels.has(p.toLowerCase())).map((p) => (
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto]">
        <input
          type="text"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="col-span-2 min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm sm:col-span-1"
        />
        <input
          type="number"
          min={0}
          placeholder="Planned (₹)"
          value={planned}
          onChange={(e) => setPlanned(e.target.value)}
          className="min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          min={0}
          placeholder="Actual (₹)"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          className="min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="col-span-2 min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm sm:col-span-1"
        />
        <button
          onClick={() => m.mutate()}
          disabled={!canSave}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      {dup && (
        <p className="mt-1.5 text-[11px] text-red-600">An expense with this label already exists.</p>
      )}
    </div>
  );
}

function AdminRow({
  row,
  projectId,
  queryKey,
}: {
  row: OtherExpense;
  projectId: string;
  queryKey: readonly unknown[];
}) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const confirmDelete = useConfirmDelete();
  const upsert = useServerFn(upsertProjectOtherExpense);
  const del = useServerFn(deleteProjectOtherExpense);

  const [label, setLabel] = useState(row.label);
  const [planned, setPlanned] = useState(row.planned_amount?.toString() ?? "");
  const [actual, setActual] = useState(row.actual_amount?.toString() ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");

  const dirty =
    label !== row.label ||
    planned !== (row.planned_amount?.toString() ?? "") ||
    actual !== (row.actual_amount?.toString() ?? "") ||
    notes !== (row.notes ?? "");

  const saveM = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: row.id,
          project_id: projectId,
          label: label.trim(),
          planned_amount: planned === "" ? null : Number(planned),
          actual_amount: actual === "" ? null : Number(actual),
          notes: notes.trim() === "" ? null : notes.trim(),
          sort_order: row.sort_order,
        },
      }),
    onSuccess: () => {
      notifySuccess("Saved");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e) => notifyError(e, "Could not save"),
  });

  const deleteM = useMutation({
    mutationFn: () => del({ data: { id: row.id } }),
    onSuccess: () => {
      notifySuccess("Deleted");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e) => notifyError(e, "Could not delete"),
  });

  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-3 py-1.5">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="number"
          min={0}
          value={planned}
          onChange={(e) => setPlanned(e.target.value)}
          placeholder="0"
          className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-right text-sm tabular-nums"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="number"
          min={0}
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          placeholder="0"
          className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-right text-sm tabular-nums"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="—"
          className="w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => saveM.mutate()}
            disabled={!dirty || saveM.isPending || label.trim() === ""}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> Save
          </button>
          {isAdmin && (
            <button
              onClick={async () => {
                const ok = await confirmDelete({
                  title: `Delete "${row.label}"?`,
                  description: "This expense will be removed from the project.",
                  confirmLabel: "Delete",
                });
                if (ok) deleteM.mutate();
              }}
              disabled={deleteM.isPending}
              className="inline-flex items-center justify-center rounded-md border border-[var(--border)] p-1 text-[var(--charcoal)]/60 hover:border-red-500 hover:text-red-600 disabled:opacity-50"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
