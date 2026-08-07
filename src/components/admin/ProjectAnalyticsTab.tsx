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
  listVendorPaymentMatrix,
  upsertVendorPaymentInstallment,
  updateQuoteVendorPaymentInstallmentCount,
  updateQuoteVendorPaymentRemarks,
  type CommissionMatrixRow,
  type CommissionInstallmentSlot,
  type VendorPaymentMatrixRow,
  type VendorPaymentInstallmentSlot,
} from "@/lib/project-analytics.functions";
import { setQuoteCommission } from "@/lib/quote-commission.functions";
import { getProject, updateProject } from "@/lib/projects.functions";
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

// -------------------- Shared installment cell colour helper -----------------

function slotCellClass(status: string) {
  if (status === "received" || status === "paid")
    return "bg-[var(--gold-soft)] text-[hsl(38_45%_28%)] border-[var(--gold)]/40 hover:border-[var(--gold)]/70";
  if (status === "partial")
    return "bg-[var(--champagne)] text-[var(--terracotta)] border-[var(--terracotta)]/30 hover:border-[var(--terracotta)]/60";
  if (status === "overdue")
    return "bg-[var(--terracotta-soft)] text-[var(--terracotta)] border-[var(--terracotta)]/50 hover:border-[var(--terracotta)]";
  return "bg-[var(--cream)] text-[var(--charcoal)]/74 border-[var(--border)] hover:bg-[var(--cream-deep)]";
}

function slotLabel(status: string) {
  if (status === "received") return "Received";
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  if (status === "overdue") return "Overdue";
  return "Pending";
}

// -------------------- Section heading ---------------------------------------

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-xl text-[var(--charcoal)]">{title}</h2>
      <p className="text-xs text-[var(--charcoal)]/70">{sub}</p>
    </div>
  );
}

// -------------------- Main tab ----------------------------------------------

export function ProjectAnalyticsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
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
  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject({ data: { id: projectId } }),
  });
  const planningFee = Number((projectQ.data?.project as any)?.planning_fee ?? 0);
  const targetIncome = Number((projectQ.data?.project as any)?.target_income ?? 0);
  const commissionTotal = Number(overview.data?.commission ?? 0);
  const totalIncome = planningFee + commissionTotal;

  return (
    <div className="space-y-10">
      {/* 1 · Callout cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <OverviewCard label="Client Billing" value={overview.data?.client_billing ?? 0} />
        <OverviewCard label="Vendor Cost" value={overview.data?.vendor_cost ?? 0} valueClass="text-[var(--terracotta)]" />
        <OverviewCard label="Commission" value={commissionTotal} valueClass="text-[var(--terracotta)]" />
        <OverviewCard
          label="Received"
          value={(received.data?.fee_received ?? 0) + (received.data?.commission_received ?? 0)}
          valueClass="text-[hsl(38_45%_28%)]"
          hint={`Fee ${formatINRShort(received.data?.fee_received ?? 0)} · Comm ${formatINRShort(received.data?.commission_received ?? 0)}`}
        />
        <OverviewCard
          label="Pending"
          value={received.data?.pending_total ?? 0}
          valueClass="text-[var(--terracotta)]"
          hint={`Fee ${formatINRShort(received.data?.fee_pending ?? 0)} · Comm ${formatINRShort(received.data?.commission_pending ?? 0)}`}
        />
        <TargetIncomeCard
          projectId={projectId}
          target={targetIncome}
          totalIncome={totalIncome}
          onSaved={() => qc.invalidateQueries({ queryKey: ["project", projectId] })}
        />
      </div>

      {/* 2 · Project Payment */}
      <section>
        <SectionHeading
          title="Project Payment"
          sub="Client instalments received against the planning fee."
        />
        <ProjectPaymentsMatrix projectId={projectId} />
      </section>

      {/* 3 · Project P&L */}
      <section>
        <SectionHeading
          title="Project P&L"
          sub="Per closed vendor — client billing, vendor cost and commission breakdown."
        />
        <PnlTable pnl={pnl.data ?? []} isLoading={pnl.isLoading} planningFee={planningFee} targetIncome={targetIncome} />
      </section>

      {/* 4 · Vendor Payment */}
      <section>
        <SectionHeading
          title="Vendor Payment"
          sub="Track outgoing payments to each vendor. Each instalment shows who paid — Planner or Client."
        />
        <VendorPaymentMatrixTable projectId={projectId} />
      </section>

      {/* 5 · Commission Tracking */}
      <section>
        <SectionHeading
          title="Commission Tracking"
          sub="One row per closed vendor. Track commission instalments received from each vendor."
        />
        <CommissionMatrixTable projectId={projectId} />
      </section>
    </div>
  );
}

// -------------------- Callout card ------------------------------------------

function OverviewCard({
  label,
  value,
  valueClass = "text-[var(--charcoal)]",
  hint,
}: {
  label: string;
  value: number;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-white p-4">
      <div className={`font-display text-2xl font-semibold leading-tight ${valueClass}`}>
        {formatINR(Number(value))}
      </div>
      {hint && <div className="mt-1 text-[11px] text-[var(--charcoal)]/66">{hint}</div>}
      <div className="mt-auto pt-3 text-[10px] font-medium uppercase tracking-widest text-[var(--charcoal)]/70">{label}</div>
    </div>
  );
}

// -------------------- Target income card (editable) -------------------------

function TargetIncomeCard({
  projectId,
  target,
  totalIncome,
  onSaved,
}: {
  projectId: string;
  target: number;
  totalIncome: number;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(target || 0));
  const diff = totalIncome - target;
  const overTarget = diff >= 0;

  const save = async () => {
    try {
      await updateProject({ data: { id: projectId, target_income: Number(value || 0) } });
      toast.success("Target saved");
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-white p-4">
      {editing ? (
        <div className="flex items-center gap-1">
          <span className="text-[var(--charcoal)]/58 text-sm">₹</span>
          <input
            type="number" min={0} step="0.01" value={value} autoFocus
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1 text-xl font-semibold text-[var(--charcoal)]"
          />
          <button
            onClick={save}
            className="shrink-0 rounded bg-[var(--terracotta)] px-2 py-1 text-xs text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="shrink-0 rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--charcoal)]/74 hover:bg-[var(--cream)]"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="font-display text-2xl font-semibold leading-tight text-[var(--charcoal)]">
          {formatINR(target)}
        </div>
      )}
      {!editing && target > 0 && (
        <div className={`mt-1 text-[11px] font-medium ${overTarget ? "text-[hsl(38_45%_28%)]" : "text-[var(--terracotta)]"}`}>
          {overTarget ? "▲" : "▼"} {formatINRShort(Math.abs(diff))} {overTarget ? "above" : "below"} target
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-1 pt-3">
        <div className="text-[10px] font-medium uppercase tracking-widest text-[var(--charcoal)]/70">Target Income</div>
        {!editing && (
          <button
            onClick={() => { setValue(String(target || 0)); setEditing(true); }}
            className="text-[10px] font-medium uppercase tracking-widest text-[var(--terracotta)] hover:underline"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

// -------------------- Shared table shell ------------------------------------

function TableShell({ children, minWidth = "min-w-[780px]" }: { children: React.ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidth} text-sm`}>{children}</table>
      </div>
    </div>
  );
}

function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-[var(--charcoal)] text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
      {children}
    </thead>
  );
}

function TotalsRow({ children }: { children: React.ReactNode }) {
  return (
    <tfoot>
      <tr className="border-t-2 border-[var(--terracotta)]/25 bg-[var(--terracotta-soft)]/50 font-semibold text-[var(--charcoal)]">
        {children}
      </tr>
    </tfoot>
  );
}

// -------------------- Project P&L table -------------------------------------

function PnlTable({
  pnl,
  isLoading,
  planningFee,
  targetIncome,
}: {
  pnl: Array<{ quote_id: string; vendor_name: string; category: string | null; client_billing: number; vendor_cost: number; commission: number }>;
  isLoading: boolean;
  planningFee: number;
  targetIncome: number;
}) {
  const t = pnl.reduce(
    (acc, r) => {
      acc.client += Number(r.client_billing || 0);
      acc.vendor += Number(r.vendor_cost || 0);
      acc.comm += Number(r.commission || 0);
      return acc;
    },
    { client: 0, vendor: 0, comm: 0 },
  );
  const totalMargin = t.client > 0 ? (t.comm / t.client) * 100 : 0;
  const totalIncome = planningFee + t.comm;

  return (
    <TableShell minWidth="min-w-[860px]">
      <Thead>
        <tr>
          <th className="px-4 py-3 text-left">Vendor</th>
          <th className="px-4 py-3 text-left">Category</th>
          <th className="px-4 py-3 text-right">Planning fee</th>
          <th className="px-4 py-3 text-right">Client billing</th>
          <th className="px-4 py-3 text-right">Vendor cost</th>
          <th className="px-4 py-3 text-right">Commission</th>
          <th className="px-4 py-3 text-right">Margin</th>
          <th className="px-4 py-3 text-right">Total income</th>
          <th className="px-4 py-3 text-right">Target income</th>
        </tr>
      </Thead>
      <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
        {pnl.map((p) => {
          const margin = p.client_billing > 0 ? (Number(p.commission) / Number(p.client_billing)) * 100 : 0;
          return (
            <tr key={p.quote_id} className="border-t border-[var(--border)]">
              <td className="px-4 py-3 font-medium text-[var(--charcoal)]">{p.vendor_name}</td>
              <td className="px-4 py-3 text-[var(--charcoal)]/74">{p.category ?? "—"}</td>
              <td className="px-4 py-3 text-right text-[var(--charcoal)]/52">—</td>
              <td className="px-4 py-3 text-right font-medium text-[var(--charcoal)]">{formatINR(Number(p.client_billing))}</td>
              <td className="px-4 py-3 text-right text-[var(--charcoal)]/74">{formatINR(Number(p.vendor_cost))}</td>
              <td className="px-4 py-3 text-right font-semibold text-[var(--terracotta)]">{formatINR(Number(p.commission))}</td>
              <td className="px-4 py-3 text-right text-[var(--charcoal)]/82">{margin.toFixed(1)}%</td>
              <td className="px-4 py-3 text-right text-[var(--charcoal)]/52">—</td>
              <td className="px-4 py-3 text-right text-[var(--charcoal)]/52">—</td>
            </tr>
          );
        })}
        {pnl.length === 0 && (
          <tr>
            <td colSpan={9} className="px-4 py-8 text-center text-[var(--charcoal)]/66">
              {isLoading ? "Loading…" : "No closed quotes for this project yet."}
            </td>
          </tr>
        )}
      </tbody>
      {pnl.length > 0 && (
        <TotalsRow>
          <td className="px-4 py-3 text-[11px] uppercase tracking-widest text-[var(--charcoal)]/74">Totals</td>
          <td className="px-4 py-3" />
          <td className="px-4 py-3 text-right text-[var(--charcoal)]/74">{formatINR(planningFee)}</td>
          <td className="px-4 py-3 text-right">{formatINR(t.client)}</td>
          <td className="px-4 py-3 text-right text-[var(--charcoal)]/74">{formatINR(t.vendor)}</td>
          <td className="px-4 py-3 text-right text-[var(--terracotta)]">{formatINR(t.comm)}</td>
          <td className="px-4 py-3 text-right text-[var(--charcoal)]/82">{totalMargin.toFixed(1)}%</td>
          <td className="px-4 py-3 text-right text-[hsl(38_45%_28%)]">{formatINR(totalIncome)}</td>
          <td className="px-4 py-3 text-right text-[var(--charcoal)]/66">{formatINR(targetIncome)}</td>
        </TotalsRow>
      )}
    </TableShell>
  );
}

// -------------------- Project Payment matrix --------------------------------

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

  if (isLoading)
    return <div className="rounded-xl border border-[var(--border)] bg-white p-6 text-sm text-[var(--charcoal)]/66">Loading…</div>;
  if (!row)
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 text-sm text-[var(--charcoal)]/66">
        No payment record yet for this project.
      </div>
    );

  return (
    <TableShell minWidth="min-w-[700px]">
      <Thead>
        <tr>
          <th className="w-[130px] whitespace-nowrap px-4 py-3 text-right">Planning fee</th>
          <th className="w-[80px] whitespace-nowrap px-3 py-3 text-center">Inst.</th>
          {[1, 2, 3, 4].map((n) => (
            <th key={n} className="w-[96px] whitespace-nowrap px-2 py-3 text-center">Inst. {n}</th>
          ))}
          <th className="w-[110px] whitespace-nowrap px-4 py-3 text-right">Received</th>
          <th className="w-[110px] whitespace-nowrap px-4 py-3 text-right">Pending</th>
          <th className="whitespace-nowrap px-4 py-3 text-left">Remarks</th>
        </tr>
      </Thead>
      <tbody>
        <ProjectPaymentRow row={row} onChanged={refresh} />
      </tbody>
    </TableShell>
  );
}

function ProjectPaymentRow({ row, onChanged }: { row: PaymentMatrixRow; onChanged: () => void }) {
  const [remarks, setRemarks] = useState(row.payment_remarks ?? "");
  const [remarksDirty, setRemarksDirty] = useState(false);
  const [fee, setFee] = useState<string>(String(row.planning_fee ?? 0));
  const [feeDirty, setFeeDirty] = useState(false);

  const saveRemarks = useMutation({
    mutationFn: () => updateProjectPaymentRemarks({ data: { project_id: row.project_id, remarks: remarks.trim() || null } }),
    onSuccess: () => { toast.success("Remarks saved"); setRemarksDirty(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const saveFee = useMutation({
    mutationFn: () => updateProjectPlanningFee({ data: { project_id: row.project_id, planning_fee: Number(fee || 0) } }),
    onSuccess: () => { toast.success("Planning fee saved"); setFeeDirty(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <tr className="border-t border-[var(--border)] align-middle">
      <td className="px-4 py-2.5 text-right">
        <input
          type="number" min={0} step="0.01" value={fee}
          onChange={(e) => { setFee(e.target.value); setFeeDirty(true); }}
          onBlur={() => { if (feeDirty) saveFee.mutate(); }}
          className="w-28 rounded border border-[var(--border)] bg-white px-2 py-1 text-right text-xs font-medium text-[var(--charcoal)]"
        />
      </td>
      <td className="px-3 py-2.5 text-center">
        <select
          value={row.total_installments}
          onChange={(e) => {
            const n = Number(e.target.value);
            updateProjectInstallmentCount({ data: { project_id: row.project_id, total_installments: n } })
              .then(() => { toast.success("Instalment count updated"); onChanged(); })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
          }}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs font-medium text-[var(--charcoal)]"
        >
          {[1, 2, 3, 4].map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
      </td>
      {[1, 2, 3, 4].map((slotNo) => {
        if (slotNo > row.total_installments)
          return <td key={slotNo} className="px-2 py-2.5 text-center text-[var(--charcoal)]/50">—</td>;
        const slot =
          row.installments.find((s) => s.installment_no === slotNo) ??
          ({ id: null, installment_no: slotNo, expected_amount: 0, received_amount: 0, received_on: null, status: "pending" } as InstallmentSlot);
        return (
          <td key={slotNo} className="px-2 py-2.5 text-center">
            <ProjectInstallmentCell projectId={row.project_id} slot={slot} onChanged={onChanged} />
          </td>
        );
      })}
      <td className="px-4 py-2.5 text-right font-medium text-[hsl(38_45%_28%)]">{formatINR(row.total_received)}</td>
      <td className="px-4 py-2.5 text-right font-medium text-[var(--terracotta)]">{formatINR(projectPending(row))}</td>
      <td className="px-4 py-2.5">
        <input
          value={remarks}
          onChange={(e) => { setRemarks(e.target.value); setRemarksDirty(true); }}
          onBlur={() => { if (remarksDirty) saveRemarks.mutate(); }}
          placeholder="Add remarks…"
          className="w-full min-w-[160px] rounded border border-[var(--border)] bg-white px-2 py-1 text-xs"
        />
      </td>
    </tr>
  );
}

function ProjectInstallmentCell({ projectId, slot, onChanged }: { projectId: string; slot: InstallmentSlot; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex min-w-[86px] flex-col items-center rounded-md border px-2 py-1 text-[11px] leading-tight transition-colors ${slotCellClass(slot.status)}`}
        title={`${slotLabel(slot.status)} · click to edit`}
      >
        <span className="text-[9px] font-semibold uppercase tracking-wider">{slotLabel(slot.status)}</span>
        <span className="font-medium">
          {slot.received_amount > 0 ? formatINRShort(slot.received_amount)
            : slot.expected_amount > 0 ? `of ${formatINRShort(slot.expected_amount)}` : "—"}
        </span>
      </button>
      {open && (
        <ProjectInstallmentDialog projectId={projectId} slot={slot} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged(); }} />
      )}
    </>
  );
}

function ProjectInstallmentDialog({ projectId, slot, onClose, onSaved }: { projectId: string; slot: InstallmentSlot; onClose: () => void; onSaved: () => void }) {
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
    <DialogShell title={`Instalment ${slot.installment_no}`} onClose={onClose} onSave={save} busy={busy}>
      <FieldLabel label="Expected amount">
        <input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} className={inputCls} />
      </FieldLabel>
      <FieldLabel label="Received amount">
        <input type="number" min={0} value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className={inputCls} />
      </FieldLabel>
      <FieldLabel label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={inputCls}>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="overdue">Overdue</option>
        </select>
      </FieldLabel>
      <FieldLabel label="Received on">
        <input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className={inputCls} />
      </FieldLabel>
    </DialogShell>
  );
}

// -------------------- Commission Tracking table -----------------------------

function commissionPending(r: CommissionMatrixRow): number {
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
    qc.invalidateQueries({ queryKey: ["project-received", projectId] });
    qc.invalidateQueries({ queryKey: ["analytics-received"] });
  };

  const totals = useMemo(() => {
    const t = { closed: 0, commission: 0, received: 0, pending: 0, s1: 0, s2: 0 };
    for (const r of rows) {
      t.closed += Number(r.closed_amount || 0);
      t.commission += Number(r.commission_amount || 0);
      t.received += Number(r.total_received || 0);
      t.pending += commissionPending(r);
      for (const s of r.installments) {
        if (s.installment_no === 1) t.s1 += Number(s.received_amount || 0);
        if (s.installment_no === 2) t.s2 += Number(s.received_amount || 0);
      }
    }
    return t;
  }, [rows]);

  return (
    <TableShell minWidth="min-w-[900px]">
      <Thead>
        <tr>
          <th className="whitespace-nowrap px-4 py-3 text-left">Vendor</th>
          <th className="whitespace-nowrap px-4 py-3 text-left">Category</th>
          <th className="whitespace-nowrap px-4 py-3 text-right">Closed</th>
          <th className="whitespace-nowrap px-4 py-3 text-right">Commission</th>
          <th className="whitespace-nowrap px-3 py-3 text-center">Inst.</th>
          <th className="whitespace-nowrap px-2 py-3 text-center">Inst. 1</th>
          <th className="whitespace-nowrap px-2 py-3 text-center">Inst. 2</th>
          <th className="whitespace-nowrap px-4 py-3 text-right">Received</th>
          <th className="whitespace-nowrap px-4 py-3 text-right">Pending</th>
          <th className="whitespace-nowrap px-4 py-3 text-left">Remarks</th>
        </tr>
      </Thead>
      <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
        {rows.map((r) => <CommissionRow key={r.quote_id} row={r} onChanged={refresh} />)}
        {rows.length === 0 && (
          <tr>
            <td colSpan={10} className="px-4 py-8 text-center text-[var(--charcoal)]/66">
              {isLoading ? "Loading…" : "No closed vendors yet."}
            </td>
          </tr>
        )}
      </tbody>
      {rows.length > 0 && (
        <TotalsRow>
          <td className="px-4 py-3 text-[11px] uppercase tracking-widest text-[var(--charcoal)]/74">
            Totals · {rows.length} vendor{rows.length === 1 ? "" : "s"}
          </td>
          <td className="px-4 py-3" />
          <td className="px-4 py-3 text-right">{formatINR(totals.closed)}</td>
          <td className="px-4 py-3 text-right text-[var(--terracotta)]">{formatINR(totals.commission)}</td>
          <td className="px-3 py-3 text-center text-[var(--charcoal)]/58">—</td>
          <td className="px-2 py-3 text-center text-xs">{totals.s1 > 0 ? formatINRShort(totals.s1) : "—"}</td>
          <td className="px-2 py-3 text-center text-xs">{totals.s2 > 0 ? formatINRShort(totals.s2) : "—"}</td>
          <td className="px-4 py-3 text-right text-[hsl(38_45%_28%)]">{formatINR(totals.received)}</td>
          <td className="px-4 py-3 text-right text-[var(--terracotta)]">{formatINR(totals.pending)}</td>
          <td className="px-4 py-3" />
        </TotalsRow>
      )}
    </TableShell>
  );
}

function CommissionRow({ row, onChanged }: { row: CommissionMatrixRow; onChanged: () => void }) {
  const [remarks, setRemarks] = useState(row.commission_remarks ?? "");
  const [remarksDirty, setRemarksDirty] = useState(false);
  const [commission, setCommission] = useState<string>(String(row.commission_amount ?? 0));
  const [commissionDirty, setCommissionDirty] = useState(false);

  const saveRemarks = useMutation({
    mutationFn: () => updateQuoteCommissionRemarks({ data: { quote_id: row.quote_id, remarks: remarks.trim() || null } }),
    onSuccess: () => { toast.success("Remarks saved"); setRemarksDirty(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const saveCommission = useMutation({
    mutationFn: () => setQuoteCommission({ data: { quote_id: row.quote_id, commission_amount: Number(commission || 0) } }),
    onSuccess: () => { toast.success("Commission saved"); setCommissionDirty(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <tr className="border-t border-[var(--border)] align-middle">
      <td className="px-4 py-2.5 font-medium text-[var(--charcoal)]">{row.vendor_name}</td>
      <td className="px-4 py-2.5 text-[var(--charcoal)]/74">{row.category ?? "—"}</td>
      <td className="px-4 py-2.5 text-right text-[var(--charcoal)]/82">{formatINR(row.closed_amount)}</td>
      <td className="px-4 py-2.5 text-right">
        <input
          type="number" min={0} step="0.01" value={commission}
          onChange={(e) => { setCommission(e.target.value); setCommissionDirty(true); }}
          onBlur={() => { if (commissionDirty) saveCommission.mutate(); }}
          className="w-28 rounded border border-[var(--border)] bg-white px-2 py-1 text-right text-xs font-semibold text-[var(--terracotta)]"
        />
      </td>
      <td className="px-3 py-2.5 text-center">
        <select
          value={row.total_installments}
          onChange={(e) => {
            const n = Number(e.target.value);
            updateQuoteCommissionInstallmentCount({ data: { quote_id: row.quote_id, total_installments: n } })
              .then(() => { toast.success("Instalment count updated"); onChanged(); })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
          }}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs font-medium text-[var(--charcoal)]"
        >
          {[1, 2].map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
      </td>
      {[1, 2].map((slotNo) => {
        if (slotNo > row.total_installments)
          return <td key={slotNo} className="px-2 py-2.5 text-center text-[var(--charcoal)]/50">—</td>;
        const slot =
          row.installments.find((s) => s.installment_no === slotNo) ??
          ({ id: null, installment_no: slotNo, expected_amount: 0, received_amount: 0, received_on: null, status: "pending" } as CommissionInstallmentSlot);
        return (
          <td key={slotNo} className="px-2 py-2.5 text-center">
            <CommissionInstallmentCell quoteId={row.quote_id} slot={slot} onChanged={onChanged} />
          </td>
        );
      })}
      <td className="px-4 py-2.5 text-right font-medium text-[hsl(38_45%_28%)]">{formatINR(row.total_received)}</td>
      <td className="px-4 py-2.5 text-right font-medium text-[var(--terracotta)]">{formatINR(commissionPending(row))}</td>
      <td className="px-4 py-2.5">
        <input
          value={remarks}
          onChange={(e) => { setRemarks(e.target.value); setRemarksDirty(true); }}
          onBlur={() => { if (remarksDirty) saveRemarks.mutate(); }}
          placeholder="Add remarks…"
          className="w-full min-w-[160px] rounded border border-[var(--border)] bg-white px-2 py-1 text-xs"
        />
      </td>
    </tr>
  );
}

function CommissionInstallmentCell({ quoteId, slot, onChanged }: { quoteId: string; slot: CommissionInstallmentSlot; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex min-w-[86px] flex-col items-center rounded-md border px-2 py-1 text-[11px] leading-tight transition-colors ${slotCellClass(slot.status)}`}
        title={`${slotLabel(slot.status)} · click to edit`}
      >
        <span className="text-[9px] font-semibold uppercase tracking-wider">{slotLabel(slot.status)}</span>
        <span className="font-medium">
          {slot.received_amount > 0 ? formatINRShort(slot.received_amount)
            : slot.expected_amount > 0 ? `of ${formatINRShort(slot.expected_amount)}` : "—"}
        </span>
      </button>
      {open && (
        <CommissionInstallmentDialog quoteId={quoteId} slot={slot} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged(); }} />
      )}
    </>
  );
}

function CommissionInstallmentDialog({ quoteId, slot, onClose, onSaved }: { quoteId: string; slot: CommissionInstallmentSlot; onClose: () => void; onSaved: () => void }) {
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
    <DialogShell title={`Commission instalment ${slot.installment_no}`} onClose={onClose} onSave={save} busy={busy}>
      <FieldLabel label="Expected amount">
        <input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} className={inputCls} />
      </FieldLabel>
      <FieldLabel label="Received amount">
        <input type="number" min={0} value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className={inputCls} />
      </FieldLabel>
      <FieldLabel label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={inputCls}>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="overdue">Overdue</option>
        </select>
      </FieldLabel>
      <FieldLabel label="Received on">
        <input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className={inputCls} />
      </FieldLabel>
    </DialogShell>
  );
}

// -------------------- Vendor Payment table ----------------------------------

function vendorPaymentPending(r: VendorPaymentMatrixRow): number {
  return Math.max(0, Number(r.vendor_cost ?? 0) - Number(r.total_paid ?? 0));
}

function VendorPaymentMatrixTable({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendor-payment-matrix", projectId],
    queryFn: () => listVendorPaymentMatrix({ data: { project_id: projectId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["vendor-payment-matrix", projectId] });

  const totals = useMemo(() => {
    const t = { vendor_cost: 0, paid: 0, pending: 0, per_slot: [0, 0, 0, 0] as [number, number, number, number] };
    for (const r of rows) {
      t.vendor_cost += Number(r.vendor_cost || 0);
      t.paid += Number(r.total_paid || 0);
      t.pending += vendorPaymentPending(r);
      for (const s of r.installments) {
        const idx = s.installment_no - 1;
        if (idx >= 0 && idx < 4) t.per_slot[idx] += Number(s.paid_amount || 0);
      }
    }
    return t;
  }, [rows]);

  const maxSlots = rows.reduce((m, r) => Math.max(m, r.total_installments), 1);
  const colSpan = 4 + maxSlots + 3;

  return (
    <TableShell minWidth="min-w-[820px]">
      <Thead>
        <tr>
          <th className="whitespace-nowrap px-4 py-3 text-left">Vendor</th>
          <th className="whitespace-nowrap px-4 py-3 text-left">Category</th>
          <th className="whitespace-nowrap px-4 py-3 text-right">Vendor cost</th>
          <th className="whitespace-nowrap px-3 py-3 text-center">Inst.</th>
          {Array.from({ length: maxSlots }, (_, i) => (
            <th key={i} className="whitespace-nowrap px-2 py-3 text-center">Inst. {i + 1}</th>
          ))}
          <th className="whitespace-nowrap px-4 py-3 text-right">Paid</th>
          <th className="whitespace-nowrap px-4 py-3 text-right">Pending</th>
          <th className="whitespace-nowrap px-4 py-3 text-left">Remarks</th>
        </tr>
      </Thead>
      <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
        {rows.map((r) => <VendorPaymentRow key={r.quote_id} row={r} maxSlots={maxSlots} onChanged={refresh} />)}
        {rows.length === 0 && (
          <tr>
            <td colSpan={colSpan} className="px-4 py-8 text-center text-[var(--charcoal)]/66">
              {isLoading ? "Loading…" : "No closed vendors yet."}
            </td>
          </tr>
        )}
      </tbody>
      {rows.length > 0 && (
        <TotalsRow>
          <td className="px-4 py-3 text-[11px] uppercase tracking-widest text-[var(--charcoal)]/74">
            Totals · {rows.length} vendor{rows.length === 1 ? "" : "s"}
          </td>
          <td className="px-4 py-3" />
          <td className="px-4 py-3 text-right">{formatINR(totals.vendor_cost)}</td>
          <td className="px-3 py-3 text-center text-[var(--charcoal)]/58">—</td>
          {Array.from({ length: maxSlots }, (_, i) => (
            <td key={i} className="px-2 py-3 text-center text-xs">
              {totals.per_slot[i] > 0 ? formatINRShort(totals.per_slot[i]) : "—"}
            </td>
          ))}
          <td className="px-4 py-3 text-right text-[hsl(38_45%_28%)]">{formatINR(totals.paid)}</td>
          <td className="px-4 py-3 text-right text-[var(--terracotta)]">{formatINR(totals.pending)}</td>
          <td className="px-4 py-3" />
        </TotalsRow>
      )}
    </TableShell>
  );
}

function VendorPaymentRow({ row, maxSlots, onChanged }: { row: VendorPaymentMatrixRow; maxSlots: number; onChanged: () => void }) {
  const [remarks, setRemarks] = useState(row.payment_remarks ?? "");
  const [remarksDirty, setRemarksDirty] = useState(false);

  const saveRemarks = useMutation({
    mutationFn: () => updateQuoteVendorPaymentRemarks({ data: { quote_id: row.quote_id, remarks: remarks.trim() || null } }),
    onSuccess: () => { toast.success("Remarks saved"); setRemarksDirty(false); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <tr className="border-t border-[var(--border)] align-middle">
      <td className="px-4 py-2.5 font-medium text-[var(--charcoal)]">{row.vendor_name}</td>
      <td className="px-4 py-2.5 text-[var(--charcoal)]/74">{row.category ?? "—"}</td>
      <td className="px-4 py-2.5 text-right text-[var(--charcoal)]/82">{formatINR(row.vendor_cost)}</td>
      <td className="px-3 py-2.5 text-center">
        <select
          value={row.total_installments}
          onChange={(e) => {
            const n = Number(e.target.value);
            updateQuoteVendorPaymentInstallmentCount({ data: { quote_id: row.quote_id, total_installments: n } })
              .then(() => { toast.success("Instalment count updated"); onChanged(); })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
          }}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs font-medium text-[var(--charcoal)]"
        >
          {[1, 2, 3, 4].map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
      </td>
      {Array.from({ length: maxSlots }, (_, i) => {
        const slotNo = i + 1;
        if (slotNo > row.total_installments)
          return <td key={slotNo} className="px-2 py-2.5 text-center text-[var(--charcoal)]/50">—</td>;
        const slot =
          row.installments.find((s) => s.installment_no === slotNo) ??
          ({ id: null, installment_no: slotNo, expected_amount: 0, paid_amount: 0, paid_on: null, status: "pending", paid_by: "planner" } as VendorPaymentInstallmentSlot);
        return (
          <td key={slotNo} className="px-2 py-2.5 text-center">
            <VendorPaymentInstallmentCell quoteId={row.quote_id} slot={slot} onChanged={onChanged} />
          </td>
        );
      })}
      <td className="px-4 py-2.5 text-right font-medium text-[hsl(38_45%_28%)]">{formatINR(row.total_paid)}</td>
      <td className="px-4 py-2.5 text-right font-medium text-[var(--terracotta)]">{formatINR(vendorPaymentPending(row))}</td>
      <td className="px-4 py-2.5">
        <input
          value={remarks}
          onChange={(e) => { setRemarks(e.target.value); setRemarksDirty(true); }}
          onBlur={() => { if (remarksDirty) saveRemarks.mutate(); }}
          placeholder="Add remarks…"
          className="w-full min-w-[160px] rounded border border-[var(--border)] bg-white px-2 py-1 text-xs"
        />
      </td>
    </tr>
  );
}

function VendorPaymentInstallmentCell({ quoteId, slot, onChanged }: { quoteId: string; slot: VendorPaymentInstallmentSlot; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const isPaidOrPartial = slot.status === "paid" || slot.status === "partial";
  const paidByLabel = slot.paid_by === "client" ? "Client" : "Planner";
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex min-w-[86px] flex-col items-center rounded-md border px-2 py-1 text-[11px] leading-tight transition-colors ${slotCellClass(slot.status)}`}
        title={`${slotLabel(slot.status)} · ${paidByLabel} · click to edit`}
      >
        <span className="text-[9px] font-semibold uppercase tracking-wider">{slotLabel(slot.status)}</span>
        <span className="font-medium">
          {slot.paid_amount > 0 ? formatINRShort(slot.paid_amount)
            : slot.expected_amount > 0 ? `of ${formatINRShort(slot.expected_amount)}` : "—"}
        </span>
        {isPaidOrPartial && (
          <span className="text-[9px] opacity-55">{paidByLabel}</span>
        )}
      </button>
      {open && (
        <VendorPaymentInstallmentDialog quoteId={quoteId} slot={slot} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged(); }} />
      )}
    </>
  );
}

function VendorPaymentInstallmentDialog({ quoteId, slot, onClose, onSaved }: { quoteId: string; slot: VendorPaymentInstallmentSlot; onClose: () => void; onSaved: () => void }) {
  const [expected, setExpected] = useState(String(slot.expected_amount || ""));
  const [paidAmount, setPaidAmount] = useState(String(slot.paid_amount || ""));
  const [status, setStatus] = useState<VendorPaymentInstallmentSlot["status"]>(slot.status);
  const [paidOn, setPaidOn] = useState(slot.paid_on ?? "");
  const [paidBy, setPaidBy] = useState<VendorPaymentInstallmentSlot["paid_by"]>(slot.paid_by);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await upsertVendorPaymentInstallment({
        data: {
          quote_id: quoteId,
          installment_no: slot.installment_no,
          expected_amount: Number(expected || 0),
          paid_amount: Number(paidAmount || 0),
          status,
          paid_on: status === "paid" ? (paidOn || new Date().toISOString().slice(0, 10)) : paidOn || null,
          paid_by: paidBy,
        },
      });
      toast.success("Saved"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <DialogShell title={`Vendor payment instalment ${slot.installment_no}`} onClose={onClose} onSave={save} busy={busy}>
      <FieldLabel label="Expected amount">
        <input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} className={inputCls} />
      </FieldLabel>
      <FieldLabel label="Paid amount">
        <input type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className={inputCls} />
      </FieldLabel>
      <FieldLabel label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={inputCls}>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </FieldLabel>
      <FieldLabel label="Paid on">
        <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputCls} />
      </FieldLabel>
      <FieldLabel label="Paid by">
        <select value={paidBy} onChange={(e) => setPaidBy(e.target.value as any)} className={inputCls}>
          <option value="planner">Planner</option>
          <option value="client">Client</option>
        </select>
      </FieldLabel>
    </DialogShell>
  );
}

// -------------------- Shared dialog primitives ------------------------------

const inputCls = "mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm text-[var(--charcoal)] focus:outline-none focus:border-[var(--terracotta)]/50";

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--charcoal)]/82">
      {label}
      {children}
    </label>
  );
}

function DialogShell({
  title, onClose, onSave, busy, children,
}: { title: string; onClose: () => void; onSave: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--charcoal)]/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--cream)] p-5 shadow-2xl">
        <h3 className="font-display text-lg text-[var(--charcoal)]">{title}</h3>
        <div className="mt-4 grid gap-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-[var(--border)] bg-white px-4 py-1.5 text-sm text-[var(--charcoal)]/82 hover:border-[var(--charcoal)]/30 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="rounded-lg bg-[var(--terracotta)] px-4 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
