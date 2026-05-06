import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserPlus, Trash2, KeyRound, X, Check, Calendar, Pencil, LayoutGrid, ListFilter, FileText, Paperclip, CircleCheck } from "lucide-react";
import { ClientStatusPill, StatusCountsRow, CLIENT_STATUS_OPTIONS } from "@/components/admin/ClientStatusPill";
import { AuthGate } from "@/components/AuthGate";
import {
  getProject,
  createProjectClient,
  resetProjectClientPassword,
  setProjectClientEmail,
  removeProjectClient,
  unassignVendorFromProject,
  deleteProject,
} from "@/server/projects.functions";
import { useAuth } from "@/lib/auth";
import { ProjectVendorQuotesPanel } from "@/components/admin/ProjectVendorQuotesPanel";
import { listProjectVendorQuotes } from "@/lib/quote-api";
import { formatINR } from "@/lib/quote-types";

export const Route = createFileRoute("/admin/projects/$id")({
  head: () => ({ meta: [{ title: "Project — Saffron Planning Studio" }] }),
  component: () => (
    <AuthGate>
      <ProjectDetailPage />
    </AuthGate>
  ),
});

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { role } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { id } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["project", id] });

  const [showAddClient, setShowAddClient] = useState(false);
  const [cEmail, setCEmail] = useState("");
  const [cName, setCName] = useState("");
  const [cPwd, setCPwd] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [cErr, setCErr] = useState<string | null>(null);

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCErr(null);
    setCBusy(true);
    try {
      await createProjectClient({
        data: {
          project_id: id,
          email: cEmail.trim(),
          password: cPwd,
          display_name: cName.trim() || cEmail.split("@")[0],
        },
      });
      setCEmail("");
      setCName("");
      setCPwd("");
      setShowAddClient(false);
      await refresh();
    } catch (e) {
      setCErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setCBusy(false);
    }
  };

  const removeVendor = async (vendor_id: string) => {
    await unassignVendorFromProject({ data: { project_id: id, vendor_id } });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["project", id] }),
      qc.invalidateQueries({ queryKey: ["vendor-project-assignments"] }),
    ]);
  };

  const handleDeleteProject = async () => {
    if (!confirm("Delete this project? Client logins for this project will also be removed. This cannot be undone.")) return;
    await deleteProject({ data: { id } });
    window.location.href = "/admin/projects";
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-sm text-[var(--charcoal)]/60">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-6">
        <div className="rounded-lg bg-white p-6 text-sm text-red-700 shadow-sm">
          {error instanceof Error ? error.message : "Failed to load project"}
        </div>
      </div>
    );
  }

  const { project, clients, vendors, selections = {} as Record<string, { user_id: string; display_name: string; email: string; status: string; updated_at: string }[]> } = data as any;

  return (
    <div className="min-h-screen bg-[var(--cream)] px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/admin/projects" className="inline-flex items-center gap-1 text-sm text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]">
          <ArrowLeft className="h-4 w-4" /> All projects
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-[var(--charcoal)]">
              {project.bride_name} <span className="text-[var(--terracotta)]">&amp;</span> {project.groom_name}
            </h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--charcoal)]/65">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(project.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            {project.notes && <p className="mt-2 text-sm text-[var(--charcoal)]/70 whitespace-pre-wrap">{project.notes}</p>}
          </div>
          {role === "admin" && (
            <button onClick={handleDeleteProject} className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>

        {/* Client logins */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-[var(--charcoal)]">Client login</h2>
            <button
              onClick={() => setShowAddClient((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
            >
              <UserPlus className="h-4 w-4" /> Add Client Login
            </button>
          </div>
          <p className="text-xs text-[var(--charcoal)]/55">
            Share these credentials with the client. They sign in at <code>/client/login</code>.
          </p>

          {showAddClient && (
            <form onSubmit={addClient} className="mt-3 grid gap-2 rounded-lg border border-[var(--border)] bg-white p-4 sm:grid-cols-3">
              <input className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" placeholder="Display name" value={cName} onChange={(e) => setCName(e.target.value)} />
              <input className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" type="email" required placeholder="Email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
              <input className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" required minLength={6} type="password" placeholder="Password (min 6)" value={cPwd} onChange={(e) => setCPwd(e.target.value)} autoComplete="new-password" />
              {cErr && <div className="sm:col-span-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{cErr}</div>}
              <div className="sm:col-span-3 flex gap-2">
                <button type="submit" disabled={cBusy} className="flex-1 rounded-md bg-[var(--charcoal)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50">
                  {cBusy ? "Creating…" : "Create"}
                </button>
                <button type="button" onClick={() => setShowAddClient(false)} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--cream)]">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-3 -mx-6 sm:mx-0 sm:rounded-lg sm:border sm:border-[var(--border)] bg-white">
            {clients.length === 0 ? (
              <div className="p-6 text-sm text-[var(--charcoal)]/60">No client login yet.</div>
            ) : (
              <div
                className="overflow-x-auto touch-pan-x"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-[var(--cream)] text-left text-xs uppercase tracking-wider text-[var(--charcoal)]/60">
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c: any) => (
                      <ClientRow key={c.id} c={c} onChanged={refresh} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Assigned vendors */}
        <AssignedVendorsSection
          projectId={id}
          vendors={vendors}
          selections={selections}
          onRemove={removeVendor}
        />
      </div>
    </div>
  );
}

function ClientRow({ c, onChanged }: { c: any; onChanged: () => void }) {
  const [resetting, setResetting] = useState(false);
  const [pwd, setPwd] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailVal, setEmailVal] = useState<string>(c.email ?? "");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const savePwd = async () => {
    await resetProjectClientPassword({ data: { user_id: c.user_id, password: pwd } });
    setPwd("");
    setResetting(false);
    onChanged();
  };

  const saveEmail = async () => {
    setEmailErr(null);
    setEmailBusy(true);
    try {
      await setProjectClientEmail({ data: { user_id: c.user_id, email: emailVal.trim() } });
      setEditingEmail(false);
      onChanged();
    } catch (e) {
      setEmailErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${c.email}? Their login will be deleted.`)) return;
    await removeProjectClient({ data: { project_id: c.project_id ?? "", user_id: c.user_id } });
    onChanged();
  };

  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-4 py-3">{c.display_name || "—"}</td>
      <td className="px-4 py-3 text-[var(--charcoal)]/70">
        {editingEmail ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <input
                type="email"
                className="rounded border border-[var(--border)] px-2 py-1 text-sm"
                value={emailVal}
                onChange={(e) => setEmailVal(e.target.value)}
              />
              <button onClick={saveEmail} disabled={emailBusy || !emailVal.trim()} className="rounded p-1 text-green-700 hover:bg-green-50 disabled:opacity-50"><Check className="h-4 w-4" /></button>
              <button onClick={() => { setEditingEmail(false); setEmailVal(c.email ?? ""); setEmailErr(null); }} className="rounded p-1 text-[var(--charcoal)]/60 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
            </div>
            {emailErr && <span className="text-xs text-red-600">{emailErr}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>{c.email}</span>
            <button onClick={() => setEditingEmail(true)} title="Change email" className="text-[var(--charcoal)]/40 hover:text-[var(--terracotta)]">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {resetting ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="password"
              minLength={6}
              placeholder="New password"
              autoComplete="new-password"
              className="rounded border border-[var(--border)] px-2 py-1 text-sm"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
            <button onClick={savePwd} disabled={pwd.length < 6} className="rounded bg-[var(--terracotta)] px-2 py-1 text-xs text-white disabled:opacity-50">
              Set
            </button>
            <button onClick={() => { setResetting(false); setPwd(""); }} className="rounded p-1 text-[var(--charcoal)]/60 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => setResetting(true)} title="Change password" className="rounded p-1.5 text-[var(--charcoal)]/60 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]">
              <KeyRound className="h-4 w-4" />
            </button>
            <button onClick={handleRemove} title="Remove client" className="rounded p-1.5 text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

type Selection = { user_id: string; display_name: string; email: string; status: string; updated_at: string };

function pickPrimary(rows: Selection[] | undefined): Selection | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0];
}

function AssignedVendorsSection({
  projectId,
  vendors,
  selections,
  onRemove,
}: {
  projectId: string;
  vendors: any[];
  selections: Record<string, Selection[]>;
  onRemove: (id: string) => void;
}) {
  const [view, setView] = useState<"list" | "grouped">("list");
  const [quotesFor, setQuotesFor] = useState<{ id: string; name: string; category: string | null } | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { like: 0, shortlisted: 0, finalised: 0, rejected: 0, thinking: 0 };
    for (const v of vendors) {
      const rows = selections[v.id] ?? [];
      for (const r of rows) if (r.status in c) c[r.status]++;
    }
    return c;
  }, [vendors, selections]);

  const grouped = useMemo(() => {
    const buckets: Record<string, { vendor: any; selection: Selection | null }[]> = {
      finalised: [],
      shortlisted: [],
      like: [],
      thinking: [],
      rejected: [],
      none: [],
    };
    for (const v of vendors) {
      const primary = pickPrimary(selections[v.id]);
      const key = primary?.status && primary.status in buckets ? primary.status : "none";
      buckets[key].push({ vendor: v, selection: primary });
    }
    return buckets;
  }, [vendors, selections]);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-[var(--charcoal)]">Assigned vendors ({vendors.length})</h2>
          <p className="text-xs text-[var(--charcoal)]/55">
            What the client has marked appears next to each vendor.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-white text-xs">
          <button
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 ${view === "list" ? "bg-[var(--cream)] text-[var(--charcoal)]" : "text-[var(--charcoal)]/60 hover:bg-[var(--cream)]/60"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setView("grouped")}
            className={`inline-flex items-center gap-1 border-l border-[var(--border)] px-2.5 py-1.5 ${view === "grouped" ? "bg-[var(--cream)] text-[var(--charcoal)]" : "text-[var(--charcoal)]/60 hover:bg-[var(--cream)]/60"}`}
          >
            <ListFilter className="h-3.5 w-3.5" /> Group by client status
          </button>
        </div>
      </div>

      {vendors.length > 0 && (
        <div className="mt-3">
          <StatusCountsRow counts={counts} />
        </div>
      )}

      {vendors.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--champagne)] bg-white py-10 text-center text-sm text-[var(--charcoal)]/60">
          No vendors assigned to this project yet.
        </div>
      ) : view === "list" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {vendors.map((v: any) => {
            const rows = selections[v.id] ?? [];
            const primary = pickPrimary(rows);
            return (
              <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-white p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--charcoal)]/55">
                    {v.category}{v.subcategory ? ` · ${v.subcategory}` : ""}
                  </div>
                  <div className="font-medium text-[var(--charcoal)]">{v.vendor_name}</div>
                  {v.price_text && <div className="text-xs text-[var(--terracotta)]">{v.price_text}</div>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ClientStatusPill status={primary?.status ?? null} />
                    {rows.length > 1 && (
                      <span className="text-[10px] text-[var(--charcoal)]/50" title={rows.map((r) => `${r.display_name || r.email}: ${r.status}`).join("\n")}>
                        +{rows.length - 1} more
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <VendorQuotesPill
                      projectId={projectId}
                      vendorId={v.id}
                      onOpen={() =>
                        setQuotesFor({ id: v.id, name: v.vendor_name, category: v.category ?? null })
                      }
                    />
                  </div>
                </div>
                <button
                  onClick={() => onRemove(v.id)}
                  title="Remove from project"
                  className="rounded p-1.5 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {(["finalised", "shortlisted", "like", "thinking", "rejected", "none"] as const).map((key) => {
            const items = grouped[key];
            if (items.length === 0) return null;
            const opt = CLIENT_STATUS_OPTIONS.find((o) => o.value === key);
            const label = opt?.label ?? "No response yet";
            return (
              <div key={key} className="rounded-lg border border-[var(--border)] bg-white">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: opt?.dot ?? "#9ca3af" }} />
                    <span className="font-medium text-[var(--charcoal)]">{label}</span>
                    <span className="text-xs text-[var(--charcoal)]/55">({items.length})</span>
                  </div>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {items.map(({ vendor: v, selection }) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--charcoal)]">{v.vendor_name}</div>
                        <div className="text-[11px] text-[var(--charcoal)]/55">
                          {v.category}{v.subcategory ? ` · ${v.subcategory}` : ""}
                          {selection && <> · marked by {selection.display_name || selection.email}</>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
