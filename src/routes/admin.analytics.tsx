import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import {
  analyticsOverview,
  analyticsProjects,
  analyticsVendors,
  analyticsCategories,
  analyticsReceivedBreakdown,
} from "@/lib/analytics.functions";
import {
  listPaymentsMatrix,
  upsertInstallmentSlot,
  updateProjectPaymentRemarks,
  updateProjectPlanningFee,
  updateProjectInstallmentCount,

  type PaymentMatrixRow,
  type InstallmentSlot,
} from "@/lib/project-payments.functions";
import { formatINR, formatINRShort } from "@/lib/quote-types";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Saffron Planning Studio" },
      { name: "description", content: "Admin analytics: revenue, commissions, project P&L and payments." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin>
      <AdminAnalyticsPage />
    </AuthGate>
  ),
});

type Preset = "month" | "quarter" | "year" | "all";

function rangeFor(preset: Preset): { from: string | null; to: string | null } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "all") return { from: null, to: null };
  if (preset === "month") {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)) };
  }
  return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(new Date(now.getFullYear(), 11, 31)) };
}

function AdminAnalyticsPage() {
  const [preset, setPreset] = useState<Preset>("year");
  const range = useMemo(() => rangeFor(preset), [preset]);

  const overview = useQuery({
    queryKey: ["analytics-overview", range],
    queryFn: () => analyticsOverview({ data: range }),
  });
  const projects = useQuery({
    queryKey: ["analytics-projects", range],
    queryFn: () => analyticsProjects({ data: range }),
  });
  const vendors = useQuery({
    queryKey: ["analytics-vendors", range],
    queryFn: () => analyticsVendors({ data: range }),
  });
  const categories = useQuery({
    queryKey: ["analytics-categories", range],
    queryFn: () => analyticsCategories({ data: range }),
  });
  const received = useQuery({
    queryKey: ["analytics-received", range],
    queryFn: () => analyticsReceivedBreakdown({ data: range }),
  });

  return (
    <div className="min-h-screen bg-[var(--cream)] py-8">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-[var(--charcoal)]">Analytics</h1>
            <p className="text-sm text-[var(--charcoal)]/60">
              Revenue, commissions, project P&amp;L and payment tracking. Admin only.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-white p-1">
            {(["month", "quarter", "year", "all"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition " +
                  (preset === p
                    ? "bg-[var(--terracotta)] text-[var(--cream)]"
                    : "text-[var(--charcoal)]/70 hover:bg-[var(--cream-deep)]")
                }
              >
                {p === "all" ? "All time" : `This ${p}`}
              </button>
            ))}
          </div>
        </div>

        {/* Overview: Client billing · Vendor cost · Commission */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <OverviewCard label="Client billing" value={overview.data?.client_billing ?? 0} tone="charcoal" />
          <OverviewCard label="Vendor cost" value={overview.data?.vendor_cost ?? 0} tone="terracotta" highlight />
          <OverviewCard label="Commission" value={overview.data?.commission ?? 0} tone="green" highlight />
        </div>

        {/* Per-project P&L */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-[var(--charcoal)]">Per-project P&amp;L</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-white">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[var(--charcoal)] text-left text-[10px] uppercase tracking-widest text-[var(--cream)]/80">
                <tr>
                  <th className="px-4 py-2.5">Project</th>
                  <th className="px-4 py-2.5">Wedding</th>
                  <th className="px-4 py-2.5 text-right">Client billing</th>
                  <th className="px-4 py-2.5 text-right">Vendor cost</th>
                  <th className="px-4 py-2.5 text-right">Commission</th>
                  <th className="px-4 py-2.5 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(projects.data ?? []).map((p) => {
                  const margin = p.client_billing > 0 ? (Number(p.commission) / Number(p.client_billing)) * 100 : 0;
                  return (
                    <tr key={p.project_id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">
                        <Link
                          to="/admin/projects/$id"
                          params={{ id: p.project_id }}
                          className="text-[var(--terracotta)] hover:underline"
                        >
                          {(p.bride_name || "?") + " & " + (p.groom_name || "?")}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--charcoal)]/70">
                        {p.wedding_date ? new Date(p.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatINR(Number(p.client_billing))}</td>
                      <td className="px-4 py-3 text-right text-[var(--charcoal)]/70">{formatINR(Number(p.vendor_cost))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--terracotta)]">{formatINR(Number(p.commission))}</td>
                      <td className="px-4 py-3 text-right">{margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {(projects.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--charcoal)]/60">
                      {projects.isLoading ? "Loading…" : "No closed quotes in this range yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Project payments matrix (below P&L) */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-[var(--charcoal)]">Project payments</h2>
          <p className="text-xs text-[var(--charcoal)]/60">
            One row per project. Click an installment to record the amount and mark it received.
          </p>
          <PaymentsMatrixTable range={range} />
        </section>

        {/* Vendor & category performance */}
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-xl text-[var(--charcoal)]">Top vendors</h2>
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-white">
              <ul className="divide-y divide-[var(--border)]">
                {(vendors.data ?? []).slice(0, 12).map((v) => (
                  <li key={v.vendor_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{v.vendor_name}</div>
                      <div className="text-[11px] text-[var(--charcoal)]/55">
                        {v.category ?? "—"} · {v.bookings} booking{Number(v.bookings) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[var(--terracotta)]">{formatINRShort(Number(v.commission))}</div>
                      <div className="text-[11px] text-[var(--charcoal)]/55">{formatINRShort(Number(v.client_billing))} billed</div>
                    </div>
                  </li>
                ))}
                {(vendors.data ?? []).length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-[var(--charcoal)]/60">No data.</li>
                )}
              </ul>
            </div>
          </div>
          <div>
            <h2 className="font-display text-xl text-[var(--charcoal)]">Category breakdown</h2>
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-white">
              <ul className="divide-y divide-[var(--border)]">
                {(categories.data ?? []).map((c) => (
                  <li key={c.category} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.category}</div>
                      <div className="text-[11px] text-[var(--charcoal)]/55">
                        {c.bookings} booking{Number(c.bookings) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatINRShort(Number(c.client_billing))}</div>
                      <div className="text-[11px] text-[var(--terracotta)]">{formatINRShort(Number(c.commission))} comm.</div>
                    </div>
                  </li>
                ))}
                {(categories.data ?? []).length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-[var(--charcoal)]/60">No data.</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: number;
  tone: "charcoal" | "muted" | "terracotta" | "green";
  highlight?: boolean;
}) {
  const toneClass =
    tone === "terracotta"
      ? "text-[var(--terracotta)]"
      : tone === "green"
      ? "text-emerald-700"
      : tone === "muted"
      ? "text-[var(--charcoal)]/70"
      : "text-[var(--charcoal)]";
  const highlightClass =
    tone === "green"
      ? "border-emerald-500/40 bg-emerald-50"
      : "border-[var(--terracotta)]/40 bg-[var(--terracotta-soft)]";
  return (
    <div
      className={
        "rounded-lg border p-4 " +
        (highlight ? highlightClass : "border-[var(--border)] bg-white")
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">{label}</div>
      <div className={"mt-1 font-display text-2xl font-semibold " + toneClass}>{formatINR(Number(value))}</div>
    </div>
  );
}

// -------------------- Payments matrix table --------------------

function rowExpectedTotal(r: PaymentMatrixRow): number {
  return r.installments.reduce((sum, s) => sum + Number(s.expected_amount || 0), 0);
}
function rowPending(r: PaymentMatrixRow): number {
  const basis = Math.max(Number(r.planning_fee || 0), rowExpectedTotal(r));
  return Math.max(0, basis - Number(r.total_received || 0));
}

function PaymentsMatrixTable({ range }: { range: { from: string | null; to: string | null } }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payments-matrix", range],
    queryFn: () => listPaymentsMatrix({ data: range }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["payments-matrix"] });
    qc.invalidateQueries({ queryKey: ["analytics-overview"] });
    qc.invalidateQueries({ queryKey: ["analytics-projects"] });
  };

  const totals = useMemo(() => {
    const t = {
      planning_fee: 0,
      total_received: 0,
      total_pending: 0,
      per_slot: [0, 0, 0, 0] as [number, number, number, number],
    };
    for (const r of rows) {
      t.planning_fee += Number(r.planning_fee || 0);
      t.total_received += Number(r.total_received || 0);
      t.total_pending += rowPending(r);
      for (const s of r.installments) {
        if (s.installment_no >= 1 && s.installment_no <= 4) {
          t.per_slot[s.installment_no - 1] += Number(s.received_amount || 0);
        }
      }
    }
    return t;
  }, [rows]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
            <tr>
              <th className="px-3 py-3">Project</th>
              <th className="px-3 py-3 text-right">Planning fee</th>
              <th className="px-3 py-3 text-center">Installments</th>
              {[1, 2, 3, 4].map((n) => (
                <th key={n} className="px-2 py-3 text-center">Inst. {n}</th>
              ))}
              <th className="px-3 py-3 text-right">Total received</th>
              <th className="px-3 py-3 text-right">Total pending</th>
              <th className="px-3 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
            {rows.map((r) => (
              <MatrixRow key={r.project_id} row={r} onChanged={refresh} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--charcoal)]/60">
                  {isLoading ? "Loading…" : "No projects in this range."}
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)]/60 font-semibold text-[var(--charcoal)]">
                <td className="px-3 py-3 text-[11px] uppercase tracking-widest text-[var(--charcoal)]/70">
                  Totals · {rows.length} project{rows.length === 1 ? "" : "s"}
                </td>
                <td className="px-3 py-3 text-right">{formatINR(totals.planning_fee)}</td>
                <td className="px-3 py-3 text-center text-[var(--charcoal)]/50">—</td>
                {totals.per_slot.map((v, i) => (
                  <td key={i} className="px-2 py-3 text-center text-xs">{v > 0 ? formatINRShort(v) : "—"}</td>
                ))}
                <td className="px-3 py-3 text-right text-green-700">{formatINR(totals.total_received)}</td>
                <td className="px-3 py-3 text-right text-[var(--terracotta)]">{formatINR(totals.total_pending)}</td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function MatrixRow({
  row,
  onChanged,
}: {
  row: PaymentMatrixRow;
  onChanged: () => void;
}) {
  const [remarks, setRemarks] = useState(row.payment_remarks ?? "");
  const [remarksDirty, setRemarksDirty] = useState(false);
  const [fee, setFee] = useState<string>(String(row.planning_fee ?? 0));
  const [feeDirty, setFeeDirty] = useState(false);

  const saveRemarks = useMutation({
    mutationFn: () =>
      updateProjectPaymentRemarks({
        data: { project_id: row.project_id, remarks: remarks.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Remarks saved");
      setRemarksDirty(false);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveFee = useMutation({
    mutationFn: () =>
      updateProjectPlanningFee({
        data: { project_id: row.project_id, planning_fee: Number(fee || 0) },
      }),
    onSuccess: () => {
      toast.success("Planning fee saved");
      setFeeDirty(false);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <tr className="border-t border-[var(--border)] align-middle">
      <td className="px-3 py-2">
        <Link
          to="/admin/projects/$id"
          params={{ id: row.project_id }}
          className="font-medium text-[var(--terracotta)] hover:underline"
        >
          {(row.bride_name || "?") + " & " + (row.groom_name || "?")}
        </Link>
        <div className="text-[11px] text-[var(--charcoal)]/55">
          {row.wedding_date ? new Date(row.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min={0}
          step="0.01"
          value={fee}
          onChange={(e) => {
            setFee(e.target.value);
            setFeeDirty(true);
          }}
          onBlur={() => {
            if (feeDirty) saveFee.mutate();
          }}
          className="w-28 rounded border border-[var(--border)] bg-white px-2 py-1 text-right text-xs font-medium"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <select
          value={row.total_installments}
          onChange={(e) => {
            const n = Number(e.target.value);
            updateProjectInstallmentCount({ data: { project_id: row.project_id, total_installments: n } })
              .then(() => {
                toast.success("Installment count updated");
                onChanged();
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
          }}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs font-medium"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </td>
      {[1, 2, 3, 4].map((slotNo) => {
        if (slotNo > row.total_installments) {
          return <td key={slotNo} className="px-2 py-2 text-center text-[var(--charcoal)]/30">—</td>;
        }
        const slot =
          row.installments.find((s) => s.installment_no === slotNo) ??
          ({ id: null, installment_no: slotNo, expected_amount: 0, received_amount: 0, received_on: null, status: "pending" } as InstallmentSlot);
        return (
          <td key={slotNo} className="px-2 py-2 text-center">
            <InstallmentCell projectId={row.project_id} slot={slot} onChanged={onChanged} />
          </td>
        );
      })}

      <td className="px-3 py-2 text-right font-medium text-green-700">{formatINR(row.total_received)}</td>
      <td className="px-3 py-2 text-right font-medium text-[var(--terracotta)]">
        {formatINR(rowPending(row))}
      </td>
      <td className="px-3 py-2 min-w-[180px]">
        <div className="flex items-center gap-1">
          <input
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value);
              setRemarksDirty(true);
            }}
            onBlur={() => {
              if (remarksDirty) saveRemarks.mutate();
            }}
            placeholder="Add remarks…"
            className="w-full rounded border border-[var(--border)] bg-white px-2 py-1 text-xs"
          />
        </div>
      </td>
    </tr>
  );
}

function InstallmentCell({
  projectId,
  slot,
  onChanged,
}: {
  projectId: string;
  slot: InstallmentSlot;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const received = slot.status === "received";
  const partial = slot.status === "partial";

  const cellClass = received
    ? "bg-green-100 hover:bg-green-200 text-green-800 border-green-300"
    : partial
    ? "bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300"
    : "bg-[var(--cream)] hover:bg-[var(--cream-deep)] text-[var(--charcoal)]/70 border-[var(--border)]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={"inline-flex min-w-[86px] flex-col items-center rounded-md border px-2 py-1 text-[11px] leading-tight " + cellClass}
        title={`${received ? "Received" : partial ? "Partial" : "Pending"} · click to edit`}
      >
        <span className="font-semibold uppercase tracking-wider text-[9px]">
          {received ? "Received" : partial ? "Partial" : "Pending"}
        </span>
        <span className="font-medium">
          {slot.received_amount > 0
            ? formatINRShort(slot.received_amount)
            : slot.expected_amount > 0
            ? `of ${formatINRShort(slot.expected_amount)}`
            : "—"}
        </span>
      </button>
      {open && (
        <InstallmentEditDialog
          projectId={projectId}
          slot={slot}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function InstallmentEditDialog({
  projectId,
  slot,
  onClose,
  onSaved,
}: {
  projectId: string;
  slot: InstallmentSlot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [expected, setExpected] = useState<string>(String(slot.expected_amount || ""));
  const [receivedAmount, setReceivedAmount] = useState<string>(String(slot.received_amount || ""));
  const [status, setStatus] = useState(slot.status);
  const [receivedOn, setReceivedOn] = useState(slot.received_on ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await upsertInstallmentSlot({
        data: {
          project_id: projectId,
          installment_no: slot.installment_no,
          expected_amount: Number(expected || 0),
          received_amount: Number(receivedAmount || 0),
          status,
          received_on: status === "received" ? (receivedOn || new Date().toISOString().slice(0, 10)) : receivedOn || null,
        },
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-[var(--cream)] p-5 shadow-2xl"
      >
        <h3 className="font-display text-lg text-[var(--charcoal)]">Installment {slot.installment_no}</h3>
        <div className="mt-3 grid gap-2 text-xs text-[var(--charcoal)]/70">
          <label>
            Expected amount
            <input
              type="number"
              min={0}
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label>
            Received amount
            <input
              type="number"
              min={0}
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as InstallmentSlot["status"])}
              className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="received">Received</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label>
            Received on
            <input
              type="date"
              value={receivedOn ?? ""}
              onChange={(e) => setReceivedOn(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
