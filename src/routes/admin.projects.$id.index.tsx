import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Trash2, KeyRound, X, Check, Calendar, Pencil, LayoutGrid, ListFilter, FileText, Paperclip, CircleCheck, MessageSquare, Star, MapPin, Instagram, Phone, Globe, Plus, Sparkles, Archive, ArchiveRestore, Eye, ChevronDown } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { ClientStatusPill, StatusCountsRow, CLIENT_STATUS_OPTIONS } from "@/components/admin/ClientStatusPill";
import { AuthGate } from "@/components/AuthGate";
import {
  getProject,
  createProjectClient,
  resetProjectClientPassword,
  setProjectClientEmail,
  setProjectClientDisplayName,
  removeProjectClient,
  unassignVendorFromProject,
  deleteProject,
  setVendorSaffronPick,
  updateProject,
  setProjectArchived,
} from "@/lib/projects.functions";
import { useAuth } from "@/lib/auth";
import { ProjectVendorQuotesPanel } from "@/components/admin/ProjectVendorQuotesPanel";
import { listProjectVendorQuotes } from "@/lib/quote-api";
import { formatINR, formatINRShort, ordinal, buildQuoteSeqMap } from "@/lib/quote-types";
import { useConfirm, useConfirmDelete } from "@/components/ui/confirm-dialog";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { EmptyState } from "@/components/ui/empty-state";

import { VendorCommentsThread } from "@/components/client/VendorCommentsThread";
import { instagramUrl, normalizeInstagramHandle } from "@/lib/instagram";
import { VendorTimeline } from "@/components/timeline/VendorTimeline";
import { listProjectCategoryDeadlines } from "@/lib/project-deadlines.functions";
import { listProjectOtherExpenses } from "@/lib/project-other-expenses.functions";
import { buildTimelineItems, otherExpensesAsTimelineItems } from "@/lib/build-timeline-items";
import { QuickAddVendorPanel } from "@/components/admin/QuickAddVendorPanel";

export const Route = createFileRoute("/admin/projects/$id/")({
  head: () => ({
    meta: [
      { title: "Project — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
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
  const confirmDelete = useConfirmDelete();
  const { data, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { id } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["project", id] });

  useRealtimeInvalidate(`admin-project-${id}`, [
    { table: "projects", filter: `id=eq.${id}`, invalidate: [["project", id]] },
    { table: "project_vendors", filter: `project_id=eq.${id}`, invalidate: [["project", id]] },
    { table: "project_clients", filter: `project_id=eq.${id}`, invalidate: [["project", id]] },
    { table: "project_vendor_quotes", filter: `project_id=eq.${id}`, invalidate: [["project", id], ["project-vendor-quotes", id]] },
    { table: "project_vendor_quote_files", invalidate: [["project", id], ["project-vendor-quotes", id]] },
    { table: "project_vendor_comments", filter: `project_id=eq.${id}`, invalidate: [["project", id], ["vendor-comments"]] },
    { table: "client_vendor_status", invalidate: [["project", id]] },
    { table: "vendors", invalidate: [["project", id]] },
    { table: "project_category_deadlines", filter: `project_id=eq.${id}`, invalidate: [["project-deadlines", id]] },
    { table: "project_other_expenses", filter: `project_id=eq.${id}`, invalidate: [["project-other-expenses", id]] },
  ]);

  const { data: deadlines = [] } = useQuery({
    queryKey: ["project-deadlines", id],
    queryFn: () => listProjectCategoryDeadlines({ data: { project_id: id } }),
  });
  const { data: otherExpenses = [] } = useQuery({
    queryKey: ["project-other-expenses", id],
    queryFn: () => listProjectOtherExpenses({ data: { project_id: id } }),
  });




  const removeVendor = async (vendor_id: string, vendor_name?: string) => {
    const ok = await confirmDelete({
      title: vendor_name ? `Remove ${vendor_name} from this project?` : "Remove this vendor?",
      description: "The vendor stays in your library, but it will no longer be visible to this client.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await unassignVendorFromProject({ data: { project_id: id, vendor_id } });
      notifySuccess("Vendor removed from project");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["project", id] }),
        qc.invalidateQueries({ queryKey: ["vendor-project-assignments"] }),
      ]);
    } catch (e) {
      notifyError(e, "Could not remove vendor");
    }
  };

  const handleDeleteProject = async () => {
    const ok = await confirmDelete({
      title: "Delete this project?",
      description:
        "Client logins for this project will also be removed. This cannot be undone.",
      confirmLabel: "Delete project",
    });
    if (!ok) return;
    try {
      await deleteProject({ data: { id } });
      notifySuccess("Project deleted");
      window.location.href = "/admin/projects";
    } catch (e) {
      notifyError(e, "Could not delete project");
    }
  };

  const handleToggleArchived = async (archived: boolean) => {
    try {
      await setProjectArchived({ data: { id, archived } });
      notifySuccess(archived ? "Project archived" : "Project restored");
      await Promise.all([
        refresh(),
        qc.invalidateQueries({ queryKey: ["projects-overview"] }),
      ]);
    } catch (e) {
      notifyError(e, archived ? "Could not archive project" : "Could not restore project");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--cream-deep)]" />
          <div className="h-9 w-72 animate-pulse rounded bg-[var(--cream-deep)]" />
          <div className="h-4 w-48 animate-pulse rounded bg-[var(--cream-deep)]/70" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-white" />
            ))}
          </div>
        </div>
      </div>
    );
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
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
      <Link to="/admin/projects" className="text-xs uppercase tracking-[0.18em] text-[var(--charcoal)]/50 hover:text-[var(--terracotta)]">
        Projects
      </Link>


        <ProjectHeader project={project} />

        <ProjectSectionTabs
          projectId={id}
          project={project}
          clients={clients}
          canDelete={role === "admin"}
          onDelete={handleDeleteProject}
          onToggleArchived={handleToggleArchived}
          onSaved={refresh}
          vendors={vendors}
          selections={selections}
          deadlines={deadlines}
          otherExpenses={otherExpenses}
          weddingDate={project.wedding_date}
          onRemoveVendor={removeVendor}
        />

    </div>
  );
}


function ProjectSectionTabs({
  projectId,
  project,
  clients,
  canDelete,
  onDelete,
  onToggleArchived,
  onSaved,
  vendors,
  selections,
  deadlines,
  otherExpenses,
  weddingDate,
  onRemoveVendor,
}: {
  projectId: string;
  project: any;
  clients: any[];
  canDelete: boolean;
  onDelete: () => void;
  onToggleArchived: (archived: boolean) => void;
  onSaved: () => void;
  vendors: any[];
  selections: Record<string, Selection[]>;
  deadlines: any[];
  otherExpenses: any[];
  weddingDate: string;
  onRemoveVendor: (id: string, name: string) => void;
}) {
  const [tab, setTab] = useState<"vendors" | "timeline" | "details">("vendors");
  const tabBtn = (key: "vendors" | "timeline" | "details", label: string, Icon: any) => (
    <button
      key={key}
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 border-l border-[var(--border)] px-4 py-2 first:border-l-0 ${
        tab === key
          ? "bg-[var(--terracotta)] text-[var(--cream)]"
          : "text-[var(--charcoal)]/70 hover:bg-[var(--cream)]"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
  const timelineItems = useMemo(
    () => [
      ...buildTimelineItems(vendors, deadlines, "admin"),
      ...otherExpensesAsTimelineItems(otherExpenses),
    ],
    [vendors, deadlines, otherExpenses],
  );
  return (
    <section className="mt-10">
      <div
        role="tablist"
        className="flex w-full overflow-hidden rounded-md border border-[var(--border)] bg-white text-sm"
      >
        {tabBtn("vendors", "Assigned Vendors", LayoutGrid)}
        {tabBtn("timeline", "Budget & Deadlines", Calendar)}
        {tabBtn("details", "Project Details", FileText)}
      </div>

      <div className="mt-4">
        {tab === "vendors" && (
          <AssignedVendorsSection
            projectId={projectId}
            vendors={vendors}
            selections={selections}
            onRemove={onRemoveVendor}
          />
        )}
        {tab === "timeline" && (
          <VendorTimeline
            projectId={projectId}
            weddingDate={weddingDate}
            items={timelineItems}
            mode="admin"
          />
        )}
        {tab === "details" && (
          <ProjectDetailsTab
            projectId={projectId}
            project={project}
            clients={clients}
            canDelete={canDelete}
            onDelete={onDelete}
            onToggleArchived={onToggleArchived}
            onSaved={onSaved}
          />
        )}
      </div>
    </section>
  );
}

function ProjectDetailsTab({
  projectId,
  project,
  clients,
  canDelete,
  onDelete,
  onToggleArchived,
  onSaved,
}: {
  projectId: string;
  project: any;
  clients: any[];
  canDelete: boolean;
  onDelete: () => void;
  onToggleArchived: (archived: boolean) => void;
  onSaved: () => void;
}) {
  const isArchived = !!project.archived_at;
  const [bride, setBride] = useState(project.bride_name);
  const [groom, setGroom] = useState(project.groom_name);
  const [date, setDate] = useState(project.wedding_date?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(project.notes ?? "");
  const [busy, setBusy] = useState(false);

  const dirty =
    bride.trim() !== project.bride_name ||
    groom.trim() !== project.groom_name ||
    date !== (project.wedding_date?.slice(0, 10) ?? "") ||
    (notes ?? "").trim() !== (project.notes ?? "");

  const save = async () => {
    if (!bride.trim() || !groom.trim() || !date) {
      notifyError(null, "Bride name, groom name and wedding date are required");
      return;
    }
    setBusy(true);
    try {
      await updateProject({
        data: {
          id: project.id,
          bride_name: bride.trim(),
          groom_name: groom.trim(),
          wedding_date: date,
          notes: notes.trim() || null,
        },
      });
      notifySuccess("Project updated");
      onSaved();
    } catch (e) {
      notifyError(e, "Could not update project");
    } finally {
      setBusy(false);
    }
  };

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
          project_id: projectId,
          email: cEmail.trim(),
          password: cPwd,
          display_name: cName.trim() || cEmail.split("@")[0],
        },
      });
      notifySuccess("Client login created");
      setCEmail("");
      setCName("");
      setCPwd("");
      setShowAddClient(false);
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setCErr(msg);
      notifyError(e, msg);
    } finally {
      setCBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--border)] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Pencil className="h-4 w-4 text-[var(--terracotta)]" />
          <h2 className="font-display text-base sm:text-lg text-[var(--charcoal)]">Edit details</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-[var(--charcoal)]/70">
            Bride name
            <input className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" value={bride} onChange={(e) => setBride(e.target.value)} />
          </label>
          <label className="text-xs text-[var(--charcoal)]/70">
            Groom name
            <input className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" value={groom} onChange={(e) => setGroom(e.target.value)} />
          </label>
          <label className="text-xs text-[var(--charcoal)]/70">
            Wedding date
            <input type="date" className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="sm:col-span-3 text-xs text-[var(--charcoal)]/70">
            Notes
            <textarea className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[var(--terracotta)]" />
            <h2 className="font-display text-base sm:text-lg text-[var(--charcoal)]">Client credentials</h2>
            <span className="rounded-full bg-[var(--cream)] px-2 py-0.5 text-[11px] text-[var(--charcoal)]/65">
              {clients.length} {clients.length === 1 ? "login" : "logins"}
            </span>
          </div>
          <button
            onClick={() => setShowAddClient((s) => !s)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            <UserPlus className="h-4 w-4" /> Add Client Login
          </button>
        </div>
        <p className="text-xs text-[var(--charcoal)]/55">
          Share these credentials with the client. They sign in at <code>/login</code>.
        </p>

        {showAddClient && (
          <form onSubmit={addClient} className="mt-3 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--cream)]/40 p-4 sm:grid-cols-3">
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

        <div className="mt-3 rounded-lg border border-[var(--border)] bg-white overflow-hidden">
          {clients.length === 0 ? (
            <div className="p-6 text-sm text-[var(--charcoal)]/60">No client login yet.</div>
          ) : (
            <div className="overflow-x-auto touch-pan-x" style={{ WebkitOverflowScrolling: "touch" }}>
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-[var(--cream)] text-left text-xs uppercase tracking-wider text-[var(--charcoal)]/60">
                  <tr>
                    <th className="px-4 py-2.5">Display Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c: any) => (
                    <ClientRow key={c.id} c={c} projectId={projectId} onChanged={onSaved} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Archive className="h-4 w-4 text-[var(--charcoal)]/70" />
          <h2 className="font-display text-base sm:text-lg text-[var(--charcoal)]">Project lifecycle</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--charcoal)]/70">
            {isArchived
              ? "This project is archived. Restore it to bring it back to the active list."
              : "Archive when the wedding is over to keep it out of the active list. You can restore anytime."}
          </div>
          <button
            onClick={() => onToggleArchived(!isArchived)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--charcoal)]/80 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
          >
            {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {isArchived ? "Restore project" : "Archive project"}
          </button>
        </div>
        {canDelete && (
          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-red-700">
              Delete this project permanently. Client logins will also be removed. This cannot be undone.
            </div>
            <button
              onClick={onDelete}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Delete project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientRow({ c, projectId, onChanged }: { c: any; projectId: string; onChanged: () => void }) {
  const confirmDelete = useConfirmDelete();
  const [resetting, setResetting] = useState(false);
  const [pwd, setPwd] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailVal, setEmailVal] = useState<string>(c.email ?? "");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState<string>(c.display_name ?? "");
  const [nameBusy, setNameBusy] = useState(false);

  const savePwd = async () => {
    try {
      await resetProjectClientPassword({ data: { user_id: c.user_id, password: pwd } });
      notifySuccess("Password updated", { description: "Client has been signed out of all sessions." });
      setPwd("");
      setResetting(false);
      onChanged();
    } catch (e) {
      notifyError(e, "Could not update password");
    }
  };

  const saveEmail = async () => {
    setEmailErr(null);
    setEmailBusy(true);
    try {
      await setProjectClientEmail({ data: { user_id: c.user_id, email: emailVal.trim() } });
      notifySuccess("Email updated");
      setEditingEmail(false);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setEmailErr(msg);
      notifyError(e, msg);
    } finally {
      setEmailBusy(false);
    }
  };

  const saveName = async () => {
    const trimmed = nameVal.trim();
    if (!trimmed) return;
    setNameBusy(true);
    try {
      await setProjectClientDisplayName({ data: { user_id: c.user_id, display_name: trimmed } });
      notifySuccess("Name updated");
      setEditingName(false);
      onChanged();
    } catch (e) {
      notifyError(e, "Could not update name");
    } finally {
      setNameBusy(false);
    }
  };

  const handleRemove = async () => {
    const ok = await confirmDelete({
      title: `Remove ${c.email}?`,
      description: "Their login will be deleted. This cannot be undone.",
      confirmLabel: "Remove client",
    });
    if (!ok) return;
    try {
      await removeProjectClient({ data: { project_id: projectId, user_id: c.user_id } });
      notifySuccess("Client removed");
      onChanged();
    } catch (e) {
      notifyError(e, "Could not remove client");
    }
  };

  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-4 py-3">
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              className="rounded border border-[var(--border)] px-2 py-1 text-sm"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              autoFocus
            />
            <button onClick={saveName} disabled={nameBusy || !nameVal.trim()} className="rounded p-1 text-green-700 hover:bg-green-50 disabled:opacity-50"><Check className="h-4 w-4" /></button>
            <button onClick={() => { setEditingName(false); setNameVal(c.display_name ?? ""); }} className="rounded p-1 text-[var(--charcoal)]/60 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>{c.display_name || "—"}</span>
            <button onClick={() => { setNameVal(c.display_name ?? ""); setEditingName(true); }} title="Change name" className="text-[var(--charcoal)]/40 hover:text-[var(--terracotta)]">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
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
            <Link
              to="/admin/projects/$id/preview/$clientId"
              params={{ id: projectId, clientId: c.user_id }}
              title="View project as this client"
              className="rounded p-1.5 text-[var(--charcoal)]/60 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <button onClick={() => setResetting(true)} title="Change password" className="rounded p-1.5 text-[var(--charcoal)]/60 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]">
              <KeyRound className="h-4 w-4" />
            </button>
            <button onClick={handleRemove} title="Remove client" className="rounded p-1.5 text-[var(--charcoal)]/55 hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]">
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

function SaffronPickToggle({
  projectId,
  vendorId,
  vendorName,
  isPicked,
}: {
  projectId: string;
  vendorId: string;
  vendorName: string;
  isPicked: boolean;
}) {
  const qc = useQueryClient();
  const queryKey = ["project", projectId];

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      setVendorSaffronPick({ data: { project_id: projectId, vendor_id: vendorId, is_saffron_pick: next } }),
    onMutate: async (next: boolean) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<any>(queryKey);
      qc.setQueryData<any>(queryKey, (old: any) => {
        if (!old) return old;
        const patch = (arr: any[] | undefined) =>
          arr?.map((v) => (v.id === vendorId ? { ...v, is_saffron_pick: next } : v));
        return {
          ...old,
          vendors: patch(old.vendors),
          assigned_vendors: patch(old.assigned_vendors),
        };
      });
      return { previous, next };
    },
    onError: (e, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
      notifyError(e, "Could not update Saffron's Preference");
    },
    onSuccess: (_d, next) => {
      notifySuccess(next ? `Marked ${vendorName} as Saffron's Preference` : `Removed Saffron's Preference from ${vendorName}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  return (
    <label
      className={
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer select-none " +
        (isPicked
          ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
          : "border-dashed border-[var(--terracotta)]/40 bg-white text-[var(--terracotta)]/70 hover:bg-[var(--terracotta-soft)]/60")
      }
      title={isPicked ? "Saffron's Preference is on — click to remove" : "Mark as Saffron's Preference"}
    >
      <Switch
        checked={isPicked}
        onCheckedChange={(next) => mutation.mutate(next)}
        className="data-[state=checked]:bg-[var(--terracotta)]"
      />
      <Sparkles className={isPicked ? "h-3 w-3 fill-current" : "h-3 w-3"} />
      <span>Saffron's Pick</span>
    </label>
  );
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
  onRemove: (id: string, name: string) => void;
}) {
  const [view, setView] = useState<"list" | "grouped">("list");
  const [quotesFor, setQuotesFor] = useState<{ id: string; name: string; category: string | null; autoOpenForm?: boolean } | null>(null);
  const [commentsFor, setCommentsFor] = useState<{ id: string; name: string } | null>(null);

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

  const assignedVendorIds = useMemo(() => new Set(vendors.map((v: any) => v.id)), [vendors]);

  return (
    <section className="mt-10">
      <QuickAddVendorPanel projectId={projectId} assignedVendorIds={assignedVendorIds} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h2 className="font-display text-2xl text-[var(--terracotta)] sm:text-xl">Assigned Vendors ({vendors.length})</h2>
          <p className="text-xs text-[var(--charcoal)]/55 my-[10px]">
            What the client has marked appears next to each vendor.
          </p>
        </div>
        <div className="inline-flex w-full overflow-hidden rounded-md border border-[var(--border)] bg-white text-xs sm:w-auto">
          <button
            onClick={() => setView("list")}
            className={`inline-flex flex-1 items-center justify-center gap-1 px-2.5 py-1.5 sm:flex-none ${view === "list" ? "bg-[var(--cream)] text-[var(--charcoal)]" : "text-[var(--charcoal)]/60 hover:bg-[var(--cream)]/60"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setView("grouped")}
            className={`inline-flex flex-1 items-center justify-center gap-1 border-l border-[var(--border)] px-2.5 py-1.5 sm:flex-none ${view === "grouped" ? "bg-[var(--cream)] text-[var(--charcoal)]" : "text-[var(--charcoal)]/60 hover:bg-[var(--cream)]/60"}`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Group by client status</span>
            <span className="sm:hidden">Grouped</span>
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
              <div key={v.id} className="relative flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-white p-3 pr-10 sm:pr-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--charcoal)]/55">
                    {v.category}{v.subcategory ? ` · ${v.subcategory}` : ""}
                  </div>
                  <div className="font-medium text-[var(--charcoal)]">{v.vendor_name}</div>
                  {v.price_text && <div className="text-xs text-[var(--terracotta)]">{v.price_text}</div>}
                  <VendorMetaRow vendor={v} />
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ClientStatusPill status={primary?.status ?? null} />
                    {rows.length > 1 && (
                      <span className="text-[10px] text-[var(--charcoal)]/50" title={rows.map((r) => `${r.display_name || r.email}: ${r.status}`).join("\n")}>
                        +{rows.length - 1} more
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <VendorQuotesPill
                      projectId={projectId}
                      vendorId={v.id}
                      onOpen={() =>
                        setQuotesFor({ id: v.id, name: v.vendor_name, category: v.category ?? null, autoOpenForm: false })
                      }
                    />
                    <button
                      onClick={() => setQuotesFor({ id: v.id, name: v.vendor_name, category: v.category ?? null, autoOpenForm: true })}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--terracotta)] bg-[var(--terracotta)] px-2.5 py-1 text-[11px] font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
                      title="Add a new quote for this vendor"
                    >
                      <Plus className="h-3 w-3" /> Add quote
                    </button>
                    <SaffronPickToggle
                      projectId={projectId}
                      vendorId={v.id}
                      vendorName={v.vendor_name}
                      isPicked={!!v.is_saffron_pick}
                    />
                    <button
                      onClick={() => setCommentsFor({ id: v.id, name: v.vendor_name })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--cream)] px-2.5 py-1 text-[11px] text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]"
                      title="View client comments for this vendor"
                    >
                      <MessageSquare className="h-3 w-3" />
                      {(v.comment_count ?? 0) > 0 ? `${v.comment_count} comment${v.comment_count === 1 ? "" : "s"}` : "No comments"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(v.id, v.vendor_name)}
                  title="Remove from project"
                  className="absolute right-2 top-2 rounded p-1.5 text-[var(--charcoal)]/55 hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)] sm:static"
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

      {quotesFor && (
        <ProjectVendorQuotesPanel
          projectId={projectId}
          vendorId={quotesFor.id}
          vendorName={quotesFor.name}
          vendorCategory={quotesFor.category}
          autoOpenForm={quotesFor.autoOpenForm}
          onClose={() => setQuotesFor(null)}
        />
      )}

      {commentsFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setCommentsFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl bg-[var(--cream)] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--cream)] px-5 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--charcoal)]/55">
                  Client comments
                </div>
                <h3 className="font-display text-xl text-[var(--charcoal)]">{commentsFor.name}</h3>
              </div>
              <button onClick={() => setCommentsFor(null)} className="rounded p-1 hover:bg-[var(--cream-deep)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <VendorCommentsThread
                projectId={projectId}
                vendorId={commentsFor.id}
                asStaff
                adminCanDelete
              />

            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function VendorQuotesPill({
  projectId,
  vendorId,
  onOpen,
}: {
  projectId: string;
  vendorId: string;
  onOpen: (autoOpenForm: boolean) => void;
}) {
  const { data: quotes = [] } = useQuery({
    queryKey: ["project-vendor-quotes", projectId, vendorId],
    queryFn: () => listProjectVendorQuotes(projectId, vendorId),
    staleTime: 30_000,
  });
  const fileCount = quotes.reduce((n, q) => n + (q.files?.length ?? 0), 0);
  if (quotes.length === 0) return null;
  const seqMap = buildQuoteSeqMap(quotes);
  const ordered = [
    ...quotes.filter((q) => q.is_final || q.status === "closed"),
    ...quotes.filter((q) => !(q.is_final || q.status === "closed")),
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ordered.map((q) => {
        const closed = q.is_final || q.status === "closed";
        const amt = closed && q.closed_amount != null ? q.closed_amount : q.quote_amount;
        const seqLabel = closed ? "Closed Quote" : `${ordinal(seqMap[q.id])} Quote`;
        const amtLabel = amt != null ? formatINRShort(amt) : null;
        const datePart = new Date(q.created_at).toLocaleDateString("en-IN");
        const fullPart = amt != null ? ` · ${formatINR(amt)}` : "";
        const tip = closed
          ? `${seqLabel}${fullPart} — click to manage`
          : `${seqLabel} · ${datePart}${fullPart} — click to manage`;
        return (
          <button
            key={q.id}
            onClick={() => onOpen(false)}
            className={
              closed
                ? "inline-flex items-center gap-1 rounded-full border border-[var(--sage)] bg-[var(--sage)]/40 px-2.5 py-1 text-[11px] font-semibold text-[var(--terracotta)] hover:border-[var(--terracotta)]"
                : "inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--cream)] px-2.5 py-1 text-[11px] text-[var(--charcoal)]/80 hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]"
            }
            title={tip}
          >
            {closed ? <CircleCheck className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            <span>{seqLabel}{amtLabel ? ` · ${amtLabel}` : ""}</span>
          </button>
        );
      })}
      {fileCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--charcoal)]/55">
          <Paperclip className="h-2.5 w-2.5" /> {fileCount}
        </span>
      )}
    </div>
  );
}

function VendorMetaRow({ vendor: v }: { vendor: any }) {
  const items: React.ReactNode[] = [];
  if (v.google_rating != null) {
    items.push(
      <span key="rating" className="inline-flex items-center gap-0.5">
        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
        {Number(v.google_rating).toFixed(1)}
      </span>,
    );
  }
  if (v.location) {
    items.push(
      <span key="loc" className="inline-flex items-center gap-0.5">
        <MapPin className="h-3 w-3" />
        {v.location}
      </span>,
    );
  }
  if (v.instagram_handle) {
    const handle = normalizeInstagramHandle(v.instagram_handle);
    const href = instagramUrl(v.instagram_handle);
    if (handle && href) {
      items.push(
        <a
          key="ig"
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 hover:text-[var(--terracotta)]"
        >
          <Instagram className="h-3 w-3" />@{handle}
        </a>,
      );
    }
  }
  if (v.contact_number) {
    items.push(
      <a
        key="tel"
        href={`tel:${v.contact_number}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-0.5 hover:text-[var(--terracotta)]"
      >
        <Phone className="h-3 w-3" />
        {v.contact_number}
      </a>,
    );
  }
  if (v.website) {
    items.push(
      <a
        key="web"
        href={v.website}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-0.5 hover:text-[var(--terracotta)]"
      >
        <Globe className="h-3 w-3" /> Website
      </a>,
    );
  }
  if (items.length === 0) return null;
  return <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--charcoal)]/65">{items}</div>;
}

interface ProjectHeaderProps {
  project: { id: string; bride_name: string; groom_name: string; wedding_date: string; notes: string | null; archived_at?: string | null };
}

function ProjectHeader({ project }: ProjectHeaderProps) {
  const isArchived = !!project.archived_at;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl text-[var(--charcoal)] sm:text-3xl">
            {project.bride_name} <span className="text-[var(--terracotta)]">&amp;</span> {project.groom_name}
          </h1>
          {isArchived && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--charcoal)]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--charcoal)]/70">
              <Archive className="h-3 w-3" /> Archived
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--charcoal)]/65">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(project.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </div>
        {project.notes && <p className="mt-2 text-sm text-[var(--charcoal)]/70 whitespace-pre-wrap">{project.notes}</p>}
      </div>
    </div>
  );
}

