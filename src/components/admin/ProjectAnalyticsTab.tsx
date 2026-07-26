import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  projectAnalyticsOverview,
  projectPnl,
  projectReceivedBreakdown,
  listCommissionMatrix,
  upsertCommissionInstallment,
  updateQuoteCommissionInstallmentCount,
  updateQuoteCommissionRemarks,
  type CommissionMatrixRow,
  type CommissionInstallmentSlot,
} from "@/lib/project-analytics.functions";
import { setQuoteCommission } from "@/lib/quote-commission.functions";
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

export function ProjectAnalyticsTab({ projectId }: { projectId: string }) {
  const overview = useQuery({
    queryKey: ["project-analytics-overview", projectId],
    queryFn: () => projectAnalyticsOverview({ data: { project_id: projectId } }),
  });
  const pnl = useQuery({
    queryKey: ["project-pnl", projectId],
    queryFn: () => projectPnl({ data: { project_id: projectId } }),
  });
  const received = useQuery({
    queryKey: ["project-received", projectId],
    queryFn: () => projectReceivedBreakdown({ data: { project_id: projectId } }),
  });

  return (
    <div className="space-y-10">
      {/* Callouts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard label="Client billing" value={overview.data?.client_billing ?? 0} tone="charcoal" />
        <OverviewCard label="Vendor cost" value={overview.data?.vendor_cost ?? 0} tone="terracotta" highlight />
        <OverviewCard label="Commission" value={overview.data?.commission ?? 0} tone="green" highlight />
        <OverviewCard
          label="Fee + Commission received"
          value={received.data?.total ?? 0}
          tone="gold"
          highlight
          hint={`Fee ${formatINRShort(received.data?.fee_received ?? 0)} · Comm ${formatINRShort(received.data?.commission_received ?? 0)}`}
        />
      </div>

      {/* P&L */}
      <section>
        <h2 className="font-display text-xl text-[var(--charcoal)]">Project P&amp;L</h2>
        <p className="text-xs text-[var(--charcoal)]/60">Per closed vendor for this project.</p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[var(--charcoal)] text-left text-[10px] uppercase tracking-widest text-[var(--cream)]/80">
              <tr>
                <th className="px-4 py-2.5">Vendor</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5 text-right">Client billing</th>
                <th className="px-4 py-2.5 text-right">Vendor cost</th>
                <th className="px-4 py-2.5 text-right">Commission</th>
                <th className="px-4 py-2.5 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
              {(pnl.data ?? []).map((p) => {
                const margin = p.client_billing > 0 ? (Number(p.commission) / Number(p.client_billing)) * 100 : 0;
                return (
                  <tr key={p.quote_id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium">{p.vendor_name}</td>
                    <td className="px-4 py-3 text-[var(--charcoal)]/70">{p.category ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatINR(Number(p.client_billing))}</td>
                    <td className="px-4 py-3 text-right text-[var(--charcoal)]/70">{formatINR(Number(p.vendor_cost))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--terracotta)]">{formatINR(Number(p.commission))}</td>
                    <td className="px-4 py-3 text-right">{margin.toFixed(1)}%</td>
                  </tr>
                );
              })}
              {(pnl.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--charcoal)]/60">
                    {pnl.isLoading ? "Loading…" : "No closed quotes for this project yet."}
                  </td>
                </tr>
              )}
            </tbody>
            {(pnl.data ?? []).length > 0 && <PnlFooter rows={pnl.data ?? []} />}
          </table>
        </div>
      </section>

      {/* Project payments (this project only) */}
      <section>
        <h2 className="font-display text-xl text-[var(--charcoal)]">Project payment</h2>
        <p className="text-xs text-[var(--charcoal)]/60">Client instalments received against the planning fee.</p>
        <ProjectPaymentsMatrix projectId={projectId} />
      </section>

      {/* Commission tracking */}
      <section>
        <h2 className="font-display text-xl text-[var(--charcoal)]">Commission tracking</h2>
        <p className="text-xs text-[var(--charcoal)]/60">
          One row per closed vendor. Track commission instalments received from each vendor.
        </p>
        <CommissionMatrixTable projectId={projectId} />
      </section>
    </div>
  );
}

// -------------------- OverviewCard (matches master analytics) -------------

function OverviewCard({
  label,
  value,
  tone,
  highlight,
  hint,
}: {
  label: string;
  value: number;
  tone: "charcoal" | "terracotta" | "green" | "gold";
  highlight?: boolean;
  hint?: string;
}) {
  const toneClass =
    tone === "terracotta"
      ? "text-[var(--terracotta)]"
      : tone === "green"
      ? "text-emerald-700"
      : tone === "gold"
      ? "text-amber-700"
      : "text-[var(--charcoal)]";
  const highlightClass =
    tone === "green"
      ? "border-emerald-500/40 bg-emerald-50"
      : tone === "gold"
      ? "border-amber-500/40 bg-amber-50"
      : "border-[var(--terracotta)]/40 bg-[var(--terracotta-soft)]";
  return (
    <div className={"rounded-lg border p-4 " + (highlight ? highlightClass : "border-[var(--border)] bg-white")}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">{label}</div>
      <div className={"mt-1 font-display text-2xl font-semibold " + toneClass}>{formatINR(Number(value))}</div>
      {hint && <div className="mt-1 text-[11px] text-[var(--charcoal)]/60">{hint}</div>}
    </div>
  );
}

function PnlFooter({ rows }: { rows: Array<{ client_billing: number; vendor_cost: number; commission: number }> }) {
  const t = rows.reduce(
    (acc, r) => {
      acc.client += Number(r.client_billing || 0);
      acc.vendor += Number(r.vendor_cost || 0);
      acc.comm += Number(r.commission || 0);
      return acc;
    },
    { client: 0, vendor: 0, comm: 0 },
  );
  const margin = t.client > 0 ? (t.comm / t.client) * 100 : 0;
  return (
    <tfoot>
      <tr className="border-t-2 border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)]/60 font-semibold text-[var(--charcoal)]">
        <td className="px-4 py-3 text-[11px] uppercase tracking-widest text-[var(--charcoal)]/70">Totals</td>
        <td className="px-4 py-3" />
        <td className="px-4 py-3 text-right">{formatINR(t.client)}</td>
        <td className="px-4 py-3 text-right text-[var(--charcoal)]/70">{formatINR(t.vendor)}</td>
        <td className="px-4 py-3 text-right text-[var(--terracotta)]">{formatINR(t.comm)}</td>
        <td className="px-4 py-3 text-right">{margin.toFixed(1)}%</td>
      </tr>
    </tfoot>
  );
}

// -------------------- Project payments (single project) --------------------

function projectExpectedTotal(r: PaymentMatrixRow): number {
  return r.installments.reduce((sum, s) => sum + Number(s.expected_amount || 0), 0);
}
function projectPending(r: PaymentMatrixRow): number {
  const basis = Math.max(Number(r.planning_fee || 0), projectExpectedTotal(r));
  return Math.max(0, basis - Number(r.total_received || 0));
}

function ProjectPaymentsMatrix({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["payments-matrix", { from: null, to: null }],
    queryFn: () => listPaymentsMatrix({ data: { from: null, to: null } }),
  });
  const row = useMemo(() => allRows.find((r) => r.project_id === projectId) ?? null, [allRows, projectId]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["payments-matrix"] });
    qc.invalidateQueries({ queryKey: ["project-analytics-overview", projectId] });
    qc.invalidateQueries({ queryKey: ["project-received", projectId] });
    qc.invalidateQueries({ queryKey: ["analytics-received"] });
  };

  if (isLoading) {
    return <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-6 text-sm text-[var(--charcoal)]/60">Loading…</div>;
  }
  if (!row) {
    return (
      <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-6 text-sm text-[var(--charcoal)]/60">
        No payment record yet for this project.
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] table-fixed text-sm">
          <thead className="bg-[var(--charcoal)] text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
            <tr>
              <th className="w-[120px] whitespace-nowrap px-3 py-3 text-right">Planning fee</th>
              <th className="w-[90px] whitespace-nowrap px-2 py-3 text-center">Inst.</th>
              {[1, 2, 3, 4].map((n) => (
                <th key={n} className="w-[92px] whitespace-nowrap px-2 py-3 text-center">Inst. {n}</th>
              ))}
              <th className="w-[110px] whitespace-nowrap px-3 py-3 text-right">Received</th>
              <th className="w-[110px] whitespace-nowrap px-3 py-3 text-right">Pending</th>
              <th className="w-[220px] whitespace-nowrap px-3 py-3 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            <ProjectPaymentRow row={row} onChanged={refresh} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectPaymentRow({ row, onChanged }: { row: PaymentMatrixRow; onChanged: () => void }) {
  const [remarks, setRemarks] = useState(row.payment_remarks ?? "");
  const [remarksDirty, setRemarksDirty] = useState(false);
  const [fee, setFee] = useState<string>(String(row.planning_fee ?? 0));
  const [feeDirty, setFeeDirty] = useState(false);

  const saveRemarks = useMutation({
    mutationFn: () =>
      updateProjectPaymentRemarks({ data: { project_id: row.project_id, remarks: remarks.trim() || null } }),
    onSuccess: () => { toast.success("Remarks saved"); setRemarksDirty(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const saveFee = useMutation({
    mutationFn: () =>
      updateProjectPlanningFee({ data: { project_id: row.project_id, planning_fee: Number(fee || 0) } }),
    onSuccess: () => { toast.success("Planning fee saved"); setFeeDirty(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <tr className="border-t border-[var(--border)] align-middle">
      <td className="px-3 py-2 text-right">
        <input
          type="number" min={0} step="0.01" value={fee}
          onChange={(e) => { setFee(e.target.value); setFeeDirty(true); }}
          onBlur={() => { if (feeDirty) saveFee.mutate(); }}
          className="w-28 rounded border border-[var(--border)] bg-white px-2 py-1 text-right text-xs font-medium"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <select
          value={row.total_installments}
          onChange={(e) => {
            const n = Number(e.target.value);
            updateProjectInstallmentCount({ data: { project_id: row.project_id, total_installments: n } })
              .then(() => { toast.success("Instalment count updated"); onChanged(); })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
          }}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs font-medium"
        >
          {[1, 2, 3, 4].map((n) => (<option key={n} value={n}>{n}</option>))}
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
            <ProjectInstallmentCell projectId={row.project_id} slot={slot} onChanged={onChanged} />
          </td>
        );
      })}
      <td className="px-3 py-2 text-right font-medium text-green-700">{formatINR(row.total_received)}</td>
      <td className="px-3 py-2 text-right font-medium text-[var(--terracotta)]">{formatINR(projectPending(row))}</td>
      <td className="px-3 py-2 w-[220px]">
        <input
          value={remarks}
          onChange={(e) => { setRemarks(e.target.value); setRemarksDirty(true); }}
          onBlur={() => { if (remarksDirty) saveRemarks.mutate(); }}
          placeholder="Add remarks…"
          className="w-full rounded border border-[var(--border)] bg-white px-2 py-1 text-xs"
        />
      </td>
    </tr>
  );
}

function ProjectInstallmentCell({
  projectId, slot, onChanged,
}: { projectId: string; slot: InstallmentSlot; onChanged: () => void }) {
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
          {slot.received_amount > 0 ? formatINRShort(slot.received_amount)
            : slot.expected_amount > 0 ? `of ${formatINRShort(slot.expected_amount)}` : "—"}
        </span>
      </button>
      {open && (
        <ProjectInstallmentDialog
          projectId={projectId}
          slot={slot}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); onChanged(); }}
        />
      )}
    </>
  );
}

function ProjectInstallmentDialog({
  projectId, slot, onClose, onSaved,
}: { projectId: string; slot: InstallmentSlot; onClose: () => void; onSaved: () => void }) {
  const [expected, setExpected] = useState(String(slot.expected_amount || ""));
  const [receivedAmount, setReceivedAmount] = useState(String(slot.received_amount || ""));
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
      toast.success("Saved"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <InstallmentDialogShell title={`Instalment ${slot.installment_no}`} onClose={onClose} onSave={save} busy={busy}>
      <DialogFields
        expected={expected} setExpected={setExpected}
        receivedAmount={receivedAmount} setReceivedAmount={setReceivedAmount}
        status={status} setStatus={setStatus as (s: InstallmentSlot["status"]) => void}
        receivedOn={receivedOn} setReceivedOn={setReceivedOn}
      />
    </InstallmentDialogShell>
  );
}

// -------------------- Commission matrix table -----------------------------

function commissionRowPending(r: CommissionMatrixRow): number {
  return Math.max(0, Number(r.commission_amount || 0) - Number(r.total_received || 0));
}

function CommissionMatrixTable({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["commission-matrix", projectId],
    queryFn: () => listCommissionMatrix({ data: { project_id: projectId } }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["commission-matrix", projectId] });
    qc.invalidateQueries({ queryKey: ["project-analytics-overview", projectId] });
  };

  const totals = useMemo(() => {
    const t = { closed: 0, commission: 0, received: 0, pending: 0, per_slot: [0, 0] as [number, number] };
    for (const r of rows) {
      t.closed += Number(r.closed_amount || 0);
      t.commission += Number(r.commission_amount || 0);
      t.received += Number(r.total_received || 0);
      t.pending += commissionRowPending(r);
      for (const s of r.installments) {
        if (s.installment_no >= 1 && s.installment_no <= 2) {
          t.per_slot[s.installment_no - 1] += Number(s.received_amount || 0);
        }
      }
    }
    return t;
  }, [rows]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-[var(--charcoal)] text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left">Vendor</th>
              <th className="whitespace-nowrap px-3 py-3 text-left">Category</th>
              <th className="whitespace-nowrap px-3 py-3 text-right">Closed</th>
              <th className="whitespace-nowrap px-3 py-3 text-right">Commission</th>
              <th className="whitespace-nowrap px-2 py-3 text-center">Inst.</th>
              {[1, 2].map((n) => (
                <th key={n} className="whitespace-nowrap px-2 py-3 text-center">Inst. {n}</th>
              ))}
              <th className="whitespace-nowrap px-3 py-3 text-right">Received</th>
              <th className="whitespace-nowrap px-3 py-3 text-right">Pending</th>
              <th className="whitespace-nowrap px-3 py-3 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
            {rows.map((r) => (
              <CommissionRow key={r.quote_id} row={r} onChanged={refresh} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--charcoal)]/60">
                  {isLoading ? "Loading…" : "No closed vendors yet."}
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)]/60 font-semibold text-[var(--charcoal)]">
                <td className="px-3 py-3 text-[11px] uppercase tracking-widest text-[var(--charcoal)]/70">
                  Totals · {rows.length} vendor{rows.length === 1 ? "" : "s"}
                </td>
                <td className="px-3 py-3" />
                <td className="px-3 py-3 text-right">{formatINR(totals.closed)}</td>
                <td className="px-3 py-3 text-right text-[var(--terracotta)]">{formatINR(totals.commission)}</td>
                <td className="px-2 py-3 text-center text-[var(--charcoal)]/50">—</td>
                {totals.per_slot.map((v, i) => (
                  <td key={i} className="px-2 py-3 text-center text-xs">{v > 0 ? formatINRShort(v) : "—"}</td>
                ))}
                <td className="px-3 py-3 text-right text-green-700">{formatINR(totals.received)}</td>
                <td className="px-3 py-3 text-right text-[var(--terracotta)]">{formatINR(totals.pending)}</td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function CommissionRow({ row, onChanged }: { row: CommissionMatrixRow; onChanged: () => void }) {
  const [remarks, setRemarks] = useState(row.commission_remarks ?? "");
  const [remarksDirty, setRemarksDirty] = useState(false);
  const [commission, setCommission] = useState<string>(String(row.commission_amount ?? 0));
  const [commissionDirty, setCommissionDirty] = useState(false);

  const saveRemarks = useMutation({
    mutationFn: () =>
      updateQuoteCommissionRemarks({ data: { quote_id: row.quote_id, remarks: remarks.trim() || null } }),
    onSuccess: () => { toast.success("Remarks saved"); setRemarksDirty(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const saveCommission = useMutation({
    mutationFn: () =>
      setQuoteCommission({ data: { quote_id: row.quote_id, commission_amount: Number(commission || 0) } }),
    onSuccess: () => { toast.success("Commission saved"); setCommissionDirty(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <tr className="border-t border-[var(--border)] align-middle">
      <td className="px-3 py-2 font-medium">{row.vendor_name}</td>
      <td className="px-3 py-2 text-[var(--charcoal)]/70">{row.category ?? "—"}</td>
      <td className="px-3 py-2 text-right">{formatINR(row.closed_amount)}</td>
      <td className="px-3 py-2 text-right">
        <input
          type="number" min={0} step="0.01" value={commission}
          onChange={(e) => { setCommission(e.target.value); setCommissionDirty(true); }}
          onBlur={() => { if (commissionDirty) saveCommission.mutate(); }}
          className="w-28 rounded border border-[var(--border)] bg-white px-2 py-1 text-right text-xs font-semibold text-[var(--terracotta)]"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <select
          value={row.total_installments}
          onChange={(e) => {
            const n = Number(e.target.value);
            updateQuoteCommissionInstallmentCount({ data: { quote_id: row.quote_id, total_installments: n } })
              .then(() => { toast.success("Instalment count updated"); onChanged(); })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
          }}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs font-medium"
        >
          {[1, 2].map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
      </td>
      {[1, 2].map((slotNo) => {
        if (slotNo > row.total_installments) {
          return <td key={slotNo} className="px-2 py-2 text-center text-[var(--charcoal)]/30">—</td>;
        }
        const slot =
          row.installments.find((s) => s.installment_no === slotNo) ??
          ({ id: null, installment_no: slotNo, expected_amount: 0, received_amount: 0, received_on: null, status: "pending" } as CommissionInstallmentSlot);
        return (
          <td key={slotNo} className="px-2 py-2 text-center">
            <CommissionInstallmentCell quoteId={row.quote_id} slot={slot} onChanged={onChanged} />
          </td>
        );
      })}
      <td className="px-3 py-2 text-right font-medium text-green-700">{formatINR(row.total_received)}</td>
      <td className="px-3 py-2 text-right font-medium text-[var(--terracotta)]">{formatINR(commissionRowPending(row))}</td>
      <td className="px-3 py-2 min-w-[180px]">
        <input
          value={remarks}
          onChange={(e) => { setRemarks(e.target.value); setRemarksDirty(true); }}
          onBlur={() => { if (remarksDirty) saveRemarks.mutate(); }}
          placeholder="Add remarks…"
          className="w-full rounded border border-[var(--border)] bg-white px-2 py-1 text-xs"
        />
      </td>
    </tr>
  );
}

function CommissionInstallmentCell({
  quoteId, slot, onChanged,
}: { quoteId: string; slot: CommissionInstallmentSlot; onChanged: () => void }) {
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
          {slot.received_amount > 0 ? formatINRShort(slot.received_amount)
            : slot.expected_amount > 0 ? `of ${formatINRShort(slot.expected_amount)}` : "—"}
        </span>
      </button>
      {open && (
        <CommissionInstallmentDialog
          quoteId={quoteId}
          slot={slot}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); onChanged(); }}
        />
      )}
    </>
  );
}

function CommissionInstallmentDialog({
  quoteId, slot, onClose, onSaved,
}: { quoteId: string; slot: CommissionInstallmentSlot; onClose: () => void; onSaved: () => void }) {
  const [expected, setExpected] = useState(String(slot.expected_amount || ""));
  const [receivedAmount, setReceivedAmount] = useState(String(slot.received_amount || ""));
  const [status, setStatus] = useState(slot.status);
  const [receivedOn, setReceivedOn] = useState(slot.received_on ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await upsertCommissionInstallment({
        data: {
          quote_id: quoteId,
          installment_no: slot.installment_no,
          expected_amount: Number(expected || 0),
          received_amount: Number(receivedAmount || 0),
          status,
          received_on: status === "received" ? (receivedOn || new Date().toISOString().slice(0, 10)) : receivedOn || null,
        },
      });
      toast.success("Saved"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <InstallmentDialogShell title={`Commission instalment ${slot.installment_no}`} onClose={onClose} onSave={save} busy={busy}>
      <DialogFields
        expected={expected} setExpected={setExpected}
        receivedAmount={receivedAmount} setReceivedAmount={setReceivedAmount}
        status={status} setStatus={setStatus as (s: CommissionInstallmentSlot["status"]) => void}
        receivedOn={receivedOn} setReceivedOn={setReceivedOn}
      />
    </InstallmentDialogShell>
  );
}

// -------------------- Shared dialog primitives ----------------------------

function InstallmentDialogShell({
  title, onClose, onSave, busy, children,
}: { title: string; onClose: () => void; onSave: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl bg-[var(--cream)] p-5 shadow-2xl">
        <h3 className="font-display text-lg text-[var(--charcoal)]">{title}</h3>
        <div className="mt-3 grid gap-2 text-xs text-[var(--charcoal)]/70">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm">Cancel</button>
          <button onClick={onSave} disabled={busy} className="rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DialogFields({
  expected, setExpected, receivedAmount, setReceivedAmount, status, setStatus, receivedOn, setReceivedOn,
}: {
  expected: string; setExpected: (s: string) => void;
  receivedAmount: string; setReceivedAmount: (s: string) => void;
  status: "pending" | "partial" | "received" | "overdue";
  setStatus: (s: "pending" | "partial" | "received" | "overdue") => void;
  receivedOn: string; setReceivedOn: (s: string) => void;
}) {
  return (
    <>
      <label>
        Expected amount
        <input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)}
          className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
      </label>
      <label>
        Received amount
        <input type="number" min={0} value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)}
          className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
      </label>
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}
          className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm">
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="overdue">Overdue</option>
        </select>
      </label>
      <label>
        Received on
        <input type="date" value={receivedOn ?? ""} onChange={(e) => setReceivedOn(e.target.value)}
          className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
      </label>
    </>
  );
}
