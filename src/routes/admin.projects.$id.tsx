import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserPlus, Trash2, KeyRound, X, Check, Calendar, Pencil } from "lucide-react";
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
import { useVendors } from "@/hooks/useVendorData";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/projects/$id")({
  head: () => ({ meta: [{ title: "Project — Saffron Events" }] }),
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

  const { project, clients, vendors } = data;

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

          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
            {clients.length === 0 ? (
              <div className="p-6 text-sm text-[var(--charcoal)]/60">No client login yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--cream)] text-left text-xs uppercase tracking-wider text-[var(--charcoal)]/60">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <ClientRow key={c.id} c={c} onChanged={refresh} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Assigned vendors */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-[var(--charcoal)]">Assigned vendors ({vendors.length})</h2>
          <p className="text-xs text-[var(--charcoal)]/55">
            Assign vendors from the main dashboard — open any vendor card and use “Assign to projects”.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {vendors.length === 0 ? (
              <div className="sm:col-span-2 rounded-lg border border-dashed border-[var(--champagne)] bg-white py-10 text-center text-sm text-[var(--charcoal)]/60">
                No vendors assigned to this project yet.
              </div>
            ) : (
              vendors.map((v: any) => (
                <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-white p-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--charcoal)]/55">{v.category}{v.subcategory ? ` · ${v.subcategory}` : ""}</div>
                    <div className="font-medium text-[var(--charcoal)]">{v.vendor_name}</div>
                    {v.price_text && <div className="text-xs text-[var(--terracotta)]">{v.price_text}</div>}
                  </div>
                  <button
                    onClick={() => removeVendor(v.id)}
                    title="Remove from project"
                    className="rounded p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
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
              type="text"
              minLength={6}
              placeholder="New password"
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
