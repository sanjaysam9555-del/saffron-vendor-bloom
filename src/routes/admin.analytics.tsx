import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import {
  analyticsOverview,
  analyticsProjects,
  analyticsVendors,
  analyticsCategories,
} from "@/lib/analytics.functions";
import {
  listProjectPayments,
  upsertProjectPayment,
  deleteProjectPayment,
  listAdminProjectsMini,
  type PaymentStatus,
  type ProjectPayment,
} from "@/lib/project-payments.functions";
import { formatINR, formatINRShort } from "@/lib/quote-types";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";

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

  return (
    <div className="min-h-screen bg-[var(--cream)] py-8">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
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

        {/* Overview cards */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <OverviewCard label="Client billing" value={overview.data?.client_billing ?? 0} tone="charcoal" />
          <OverviewCard label="Vendor cost" value={overview.data?.vendor_cost ?? 0} tone="muted" />
          <OverviewCard label="Commission" value={overview.data?.commission ?? 0} tone="terracotta" highlight />
          <OverviewCard label="Received" value={overview.data?.received ?? 0} tone="green" />
          <OverviewCard label="Pending" value={overview.data?.pending ?? 0} tone="amber" />
        </div>

        {/* Per-project P&L */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-[var(--charcoal)]">Per-project P&amp;L</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[var(--cream)] text-left text-[10px] uppercase tracking-widest text-[var(--charcoal)]/60">
                <tr>
                  <th className="px-4 py-2.5">Project</th>
                  <th className="px-4 py-2.5">Wedding</th>
                  <th className="px-4 py-2.5 text-right">Client price</th>
                  <th className="px-4 py-2.5 text-right">Vendor cost</th>
                  <th className="px-4 py-2.5 text-right">Commission</th>
                  <th className="px-4 py-2.5 text-right">Margin</th>
                  <th className="px-4 py-2.5 text-right">Received</th>
                  <th className="px-4 py-2.5 text-right">Pending</th>
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
                      <td className="px-4 py-3 text-right text-green-700">{formatINR(Number(p.received))}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{formatINR(Number(p.pending))}</td>
                    </tr>
                  );
                })}
                {(projects.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[var(--charcoal)]/60">
                      {projects.isLoading ? "Loading…" : "No closed quotes in this range yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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

        {/* Payment ledger */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-[var(--charcoal)]">Project payments</h2>
          <p className="text-xs text-[var(--charcoal)]/60">Pick a project to add, edit and mark installments received.</p>
          <PaymentLedger />
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
  tone: "charcoal" | "muted" | "terracotta" | "green" | "amber";
  highlight?: boolean;
}) {
  const toneClass =
    tone === "terracotta"
      ? "text-[var(--terracotta)]"
      : tone === "green"
      ? "text-green-700"
      : tone === "amber"
      ? "text-amber-700"
      : tone === "muted"
      ? "text-[var(--charcoal)]/70"
      : "text-[var(--charcoal)]";
  return (
    <div
      className={
        "rounded-lg border p-4 " +
        (highlight
          ? "border-[var(--terracotta)]/40 bg-[var(--terracotta-soft)]"
          : "border-[var(--border)] bg-white")
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">{label}</div>
      <div className={"mt-1 font-display text-2xl font-semibold " + toneClass}>{formatINR(Number(value))}</div>
    </div>
  );
}

// -------------------- Payment ledger --------------------

function PaymentLedger() {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const { data: projects = [] } = useQuery({
    queryKey: ["admin-projects-mini"],
    queryFn: () => listAdminProjectsMini(),
  });
  const [projectId, setProjectId] = useState<string>("");
  const active = projectId || projects[0]?.id || "";
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["project-payments", active],
    queryFn: () => listProjectPayments({ data: { project_id: active } }),
    enabled: !!active,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["project-payments", active] });
    qc.invalidateQueries({ queryKey: ["analytics-overview"] });
    qc.invalidateQueries({ queryKey: ["analytics-projects"] });
  };

  const del = useMutation({
    mutationFn: (id: string) => deleteProjectPayment({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [editing, setEditing] = useState<ProjectPayment | null>(null);
  const [adding, setAdding] = useState(false);

  const totals = useMemo(() => {
    let expected = 0;
    let received = 0;
    for (const p of payments) {
      expected += Number(p.expected_amount);
      received += Number(p.received_amount);
    }
    return { expected, received, pending: Math.max(expected - received, 0) };
  }, [payments]);

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-[var(--charcoal)]/70">
          Project
          <select
            value={active}
            onChange={(e) => setProjectId(e.target.value)}
            className="ml-2 rounded border border-[var(--border)] px-2 py-1 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.bride_name || "?") + " & " + (p.groom_name || "?")}
                {p.wedding_date ? ` — ${new Date(p.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-4 text-xs text-[var(--charcoal)]/70">
          <span>Expected: <strong>{formatINR(totals.expected)}</strong></span>
          <span className="text-green-700">Received: <strong>{formatINR(totals.received)}</strong></span>
          <span className="text-amber-700">Pending: <strong>{formatINR(totals.pending)}</strong></span>
          <button
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-2.5 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            <Plus className="h-3 w-3" /> Add installment
          </button>
        </div>
      </div>

      {(adding || editing) && (
        <PaymentForm
          projectId={active}
          initial={editing}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            refresh();
          }}
        />
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[var(--cream)] text-left text-[10px] uppercase tracking-widest text-[var(--charcoal)]/60">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2 text-right">Expected</th>
              <th className="px-3 py-2 text-right">Received</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Received on</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <div className="font-medium">{p.label}</div>
                  {p.notes && <div className="text-[11px] text-[var(--charcoal)]/55">{p.notes}</div>}
                </td>
                <td className="px-3 py-2 text-right">{formatINR(Number(p.expected_amount))}</td>
                <td className="px-3 py-2 text-right text-green-700">{formatINR(Number(p.received_amount))}</td>
                <td className="px-3 py-2">{p.due_date ?? "—"}</td>
                <td className="px-3 py-2">{p.received_on ?? "—"}</td>
                <td className="px-3 py-2"><StatusChip s={p.status} /></td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => {
                        setAdding(false);
                        setEditing(p);
                      }}
                      className="rounded p-1.5 text-[var(--charcoal)]/60 hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirmDelete({
                          title: "Delete this installment?",
                          confirmLabel: "Delete",
                        });
                        if (ok) del.mutate(p.id);
                      }}
                      className="rounded p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--charcoal)]/60">
                  {isLoading ? "Loading…" : "No installments yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({ s }: { s: PaymentStatus }) {
  const map: Record<PaymentStatus, string> = {
    pending: "bg-[var(--cream-deep)] text-[var(--charcoal)]/70",
    partial: "bg-amber-100 text-amber-800",
    received: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
  };
  return <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + map[s]}>{s}</span>;
}

function PaymentForm({
  projectId,
  initial,
  onCancel,
  onSaved,
}: {
  projectId: string;
  initial: ProjectPayment | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [expected, setExpected] = useState(initial ? String(initial.expected_amount) : "");
  const [received, setReceived] = useState(initial ? String(initial.received_amount) : "0");
  const [due, setDue] = useState(initial?.due_date ?? "");
  const [receivedOn, setReceivedOn] = useState(initial?.received_on ?? "");
  const [status, setStatus] = useState<PaymentStatus>(initial?.status ?? "pending");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    setBusy(true);
    try {
      await upsertProjectPayment({
        data: {
          id: initial?.id,
          project_id: projectId,
          label: label.trim(),
          expected_amount: Number(expected) || 0,
          received_amount: Number(received) || 0,
          due_date: due || null,
          received_on: receivedOn || null,
          status,
          notes: notes.trim() || null,
        },
      });
      toast.success(initial ? "Updated" : "Added");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-[var(--terracotta)]/40 bg-[var(--cream)]/60 p-3">
      <div className="grid gap-2 sm:grid-cols-6">
        <input placeholder="Label (e.g. Signing amount)" value={label} onChange={(e) => setLabel(e.target.value)} className="sm:col-span-2 rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
        <input placeholder="Expected ₹" type="number" value={expected} onChange={(e) => setExpected(e.target.value)} className="rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
        <input placeholder="Received ₹" type="number" value={received} onChange={(e) => setReceived(e.target.value)} className="rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
        <input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className="rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)} className="rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm">
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="overdue">Overdue</option>
        </select>
        <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="sm:col-span-5 rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancel} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs hover:bg-[var(--cream-deep)]">
          <X className="h-3 w-3" /> Cancel
        </button>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-50">
          <Check className="h-3 w-3" /> {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
