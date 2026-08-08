import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useFocusTarget } from "@/lib/deep-link";
import { useState, useMemo, lazy, Suspense } from "react";
import { useQuery, useQueryClient, useMutation, useQueries } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Trash2, KeyRound, X, Check, Calendar, Pencil, LayoutGrid, Filter, FileText, Paperclip, CircleCheck, MessageSquare, Plus, Sparkles, Archive, ArchiveRestore, Eye, ChevronDown, Table as TableIcon, ArrowUp, ArrowDown, ArrowUpDown, BarChart3, LayoutDashboard, Users2, AlertTriangle, LayoutList, Clock3, CheckSquare } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { ClientStatusPill, CLIENT_STATUS_OPTIONS } from "@/components/admin/ClientStatusPill";
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
import { VendorTimeline } from "@/components/timeline/VendorTimeline";
import { listProjectCategoryDeadlines } from "@/lib/project-deadlines.functions";
import { listProjectOtherExpenses } from "@/lib/project-other-expenses.functions";
import { buildTimelineItems, otherExpensesAsTimelineItems } from "@/lib/build-timeline-items";
import { QuickAddVendorPanel } from "@/components/admin/QuickAddVendorPanel";
import { ColumnFilter, type ColumnFilterOption } from "@/components/ui/ColumnFilter";
import { useInstagramPreviewsBulk, useAutoEnsureMissingPreviews } from "@/hooks/use-instagram-previews";
import { AssignedVendorCard } from "@/components/admin/AssignedVendorCard";
import { useSetMobilePageTitle } from "@/lib/mobile-page-title";
import { ProjectOverviewTab } from "@/components/admin/project-tabs/ProjectOverviewTab";
import { ProjectQuotesTab } from "@/components/admin/project-tabs/ProjectQuotesTab";
import { ProjectCategoriesTab } from "@/components/admin/project-tabs/ProjectCategoriesTab";
import { ProjectGuestsTab } from "@/components/admin/project-tabs/ProjectGuestsTab";
import { ProjectCommentsTab } from "@/components/admin/project-tabs/ProjectCommentsTab";
import { ProjectTasksTab } from "@/components/admin/project-tabs/ProjectTasksTab";

const AdminProjectVendorDetail = lazy(() =>
  import("@/components/admin/AdminProjectVendorDetail").then((m) => ({ default: m.AdminProjectVendorDetail })),
);
const ProjectAnalyticsTab = lazy(() =>
  import("@/components/admin/ProjectAnalyticsTab").then((m) => ({ default: m.ProjectAnalyticsTab })),
);

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
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
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
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6">
        <ProjectHeader project={project} />

        <ProjectSectionTabs
          projectId={id}
          project={project}
          clients={clients}
          canDelete={role === "admin"}
          isAdmin={role === "admin"}
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
  isAdmin,
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
  isAdmin: boolean;
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
  type TabKey =
    | "overview"
    | "vendors"
    | "quotesAll"
    | "categories"
    | "guests"
    | "timelineOnly"
    | "commentsAll"
    | "tasks"
    | "details"
    | "analytics";
  const [tab, setTab] = useState<TabKey>("vendors");
  const tabDefs: { key: TabKey; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "vendors", label: "Assigned Vendors", icon: LayoutGrid },
    { key: "tasks", label: "Tasks", icon: CheckSquare },
    { key: "quotesAll", label: "Quotes", icon: Paperclip },
    { key: "categories", label: "Categories", icon: LayoutList },
    { key: "guests", label: "Guests", icon: Users2 },
    { key: "timelineOnly", label: "Timeline", icon: Clock3 },
    { key: "commentsAll", label: "Comments", icon: MessageSquare },
    ...(isAdmin
      ? [
          { key: "analytics" as TabKey, label: "Financials", icon: BarChart3 },
          { key: "details" as TabKey, label: "Project Details", icon: FileText },
        ]
      : []),
  ];
  const tabCols = tabDefs.length / 2;
  const mobileCols = 5;
  const timelineItems = useMemo(
    () => [
      ...buildTimelineItems(vendors, deadlines, "admin"),
      ...otherExpensesAsTimelineItems(otherExpenses),
    ],
    [vendors, deadlines, otherExpenses],
  );

  // Lifted here (not owned by AssignedVendorsSection) so the Quotes and
  // Comments tabs can open the same vendor dialogs — a vendor should look
  // identical whichever tab you jumped from.
  const [quotesFor, setQuotesFor] = useState<{ id: string; name: string; category: string | null; autoOpenForm?: boolean } | null>(null);
  const [detailVendor, setDetailVendor] = useState<any | null>(null);
  const openVendorDetail = (vendorId: string) =>
    setDetailVendor(vendors.find((v: any) => v.id === vendorId) ?? null);

  // ── Deep linking ────────────────────────────────────────────────────────
  // Universal search lands here with `?tab=…&v=<vendorId>&focus=<recordId>`:
  // switch to the right tab, open the vendor in project context, and
  // highlight the exact row once it has rendered.
  const deepLink = useSearch({ strict: false }) as { tab?: string; v?: string; focus?: string };
  const navigate = useNavigate();
  const appliedTabRef = useRef<string | null>(null);
  const appliedVendorRef = useRef<string | null>(null);

  useEffect(() => {
    const key = deepLink.tab as TabKey | undefined;
    if (!key || appliedTabRef.current === key) return;
    if (!tabDefs.some((t) => t.key === key)) return;
    appliedTabRef.current = key;
    setTab(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink.tab, isAdmin]);

  useEffect(() => {
    const id = deepLink.v;
    if (!id || appliedVendorRef.current === id) return;
    const target = vendors.find((v: any) => v.id === id);
    if (!target) return;
    appliedVendorRef.current = id;
    setDetailVendor(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink.v, vendors]);

  useFocusTarget(deepLink.focus ?? deepLink.v, vendors.length > 0);

  const clearDeepLink = () => {
    appliedVendorRef.current = null;
    if (!deepLink.v && !deepLink.focus) return;
    navigate({
      to: ".",
      search: (prev: any) => ({ ...prev, v: undefined, focus: undefined }),
      replace: true,
    } as never);
  };


  return (
    <section className="mt-2 sm:mt-10">
      {/* Below sm: a fixed 5-column grid, two rows (icon over label, small
          text) — no horizontal scrolling to hunt for a tab.
          sm and up: the even tab count (8 client / 10 admin) splits into
          two symmetric rows of equal-width, icon-beside-label buttons. */}
      <div
        role="tablist"
        className="grid grid-cols-5 overflow-hidden rounded-xl border border-[var(--border)] bg-white sm:grid-cols-[repeat(var(--tab-cols),minmax(0,1fr))]"
        style={{ "--tab-cols": tabCols } as React.CSSProperties}
      >
        {tabDefs.map(({ key, label, icon: Icon }, i) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 border-[var(--border)] px-1 py-2 text-center text-[9px] font-medium leading-tight sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5 sm:text-sm ${
              i % mobileCols !== 0 ? "border-l" : ""
            } ${i >= mobileCols ? "border-t" : ""} ${
              i % tabCols !== 0 ? "sm:border-l" : "sm:border-l-0"
            } ${i >= tabCols ? "sm:border-t" : "sm:border-t-0"} ${
              tab === key
                ? "bg-[var(--terracotta)] text-[var(--cream)]"
                : "text-[var(--charcoal)]/82 hover:bg-[var(--cream)]"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" /> <span className="sm:truncate">{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "overview" && (
          <ProjectOverviewTab projectId={projectId} vendorCount={vendors.length} onOpenVendor={openVendorDetail} />
        )}
        {tab === "vendors" && (
          <AssignedVendorsSection
            projectId={projectId}
            vendors={vendors}
            selections={selections}
            onRemove={onRemoveVendor}
            quotesFor={quotesFor}
            setQuotesFor={setQuotesFor}
            detailVendor={detailVendor}
            setDetailVendor={setDetailVendor}
          />
        )}
        {tab === "quotesAll" && (
          <ProjectQuotesTab
            projectId={projectId}
            onOpenVendorQuotes={(id, name, category) => setQuotesFor({ id, name, category })}
          />
        )}
        {tab === "categories" && <ProjectCategoriesTab projectId={projectId} isAdmin={isAdmin} />}
        {tab === "guests" && <ProjectGuestsTab projectId={projectId} />}
        {tab === "timelineOnly" && (
          <VendorTimeline
            projectId={projectId}
            weddingDate={weddingDate}
            items={timelineItems}
            mode="admin"
            hideAddButtons
          />
        )}
        {tab === "commentsAll" && <ProjectCommentsTab projectId={projectId} onOpenVendor={openVendorDetail} />}
        {tab === "tasks" && <ProjectTasksTab projectId={projectId} />}
        {tab === "details" && isAdmin && (
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
        {tab === "analytics" && isAdmin && (
          <Suspense fallback={<div className="rounded-lg border border-[var(--border)] bg-white p-6 text-sm text-[var(--charcoal)]/74">Loading analytics…</div>}>
            <ProjectAnalyticsTab projectId={projectId} />
          </Suspense>
        )}
      </div>

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

      {detailVendor && (
        <Suspense fallback={null}>
          <AdminProjectVendorDetail
            projectId={projectId}
            vendor={detailVendor}
            vendors={vendors}
            selections={selections[detailVendor.id] ?? []}
            onClose={() => setDetailVendor(null)}
            onNavigate={(v: any) => setDetailVendor(v)}
            onOpenQuotes={(autoOpenForm: boolean) =>
              setQuotesFor({
                id: detailVendor.id,
                name: detailVendor.vendor_name,
                category: detailVendor.category ?? null,
                autoOpenForm,
              })
            }
            onRemove={() => {
              const v = detailVendor;
              setDetailVendor(null);
              onRemoveVendor(v.id, v.vendor_name);
            }}
          />
        </Suspense>
      )}
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
  const [editOpen, setEditOpen] = useState(false);
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
        {/* Collapsed by default — editing is the exception, not the reason
            you open this tab. */}
        <button
          type="button"
          onClick={() => setEditOpen((o) => !o)}
          aria-expanded={editOpen}
          className="group flex w-full items-center gap-2 text-left"
        >
          <Pencil className="h-4 w-4 shrink-0 text-[var(--terracotta)]" />
          <h2 className="font-display text-base sm:text-lg text-[var(--charcoal)]">Edit details</h2>
          {dirty && !editOpen && (
            <span className="rounded-full bg-[var(--terracotta-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--terracotta)]">
              unsaved
            </span>
          )}
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 text-[var(--charcoal)]/58 transition-transform group-hover:text-[var(--terracotta)] ${editOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div className={`mt-3 grid gap-3 sm:grid-cols-3 ${editOpen ? "" : "hidden"}`}>
          <label className="text-xs text-[var(--charcoal)]/82">
            Bride name
            <input className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" value={bride} onChange={(e) => setBride(e.target.value)} />
          </label>
          <label className="text-xs text-[var(--charcoal)]/82">
            Groom name
            <input className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" value={groom} onChange={(e) => setGroom(e.target.value)} />
          </label>
          <label className="text-xs text-[var(--charcoal)]/82">
            Wedding date
            <input type="date" className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="sm:col-span-3 text-xs text-[var(--charcoal)]/82">
            Notes
            <textarea className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div className={`mt-3 justify-end ${editOpen ? "flex" : "hidden"}`}>
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
            <span className="rounded-full bg-[var(--cream)] px-2 py-0.5 text-[11px] text-[var(--charcoal)]/78">
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
        <p className="text-xs text-[var(--charcoal)]/70">
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
            <div className="p-6 text-sm text-[var(--charcoal)]/74">No client login yet.</div>
          ) : (
            <div className="overflow-x-auto touch-pan-x" style={{ WebkitOverflowScrolling: "touch" }}>
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-[var(--charcoal)] text-left text-xs uppercase tracking-wider text-[var(--cream)]/80">
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
          <Archive className="h-4 w-4 text-[var(--charcoal)]/82" />
          <h2 className="font-display text-base sm:text-lg text-[var(--charcoal)]">Project lifecycle</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--charcoal)]/82">
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
            <button onClick={() => { setEditingName(false); setNameVal(c.display_name ?? ""); }} className="rounded p-1 text-[var(--charcoal)]/74 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>{c.display_name || "—"}</span>
            <button onClick={() => { setNameVal(c.display_name ?? ""); setEditingName(true); }} title="Change name" className="text-[var(--charcoal)]/58 hover:text-[var(--terracotta)]">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--charcoal)]/82">
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
              <button onClick={() => { setEditingEmail(false); setEmailVal(c.email ?? ""); setEmailErr(null); }} className="rounded p-1 text-[var(--charcoal)]/74 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
            </div>
            {emailErr && <span className="text-xs text-red-600">{emailErr}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>{c.email}</span>
            <button onClick={() => setEditingEmail(true)} title="Change email" className="text-[var(--charcoal)]/58 hover:text-[var(--terracotta)]">
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
            <button onClick={() => { setResetting(false); setPwd(""); }} className="rounded p-1 text-[var(--charcoal)]/74 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Link
              to="/admin/projects/$id/preview/$clientId"
              params={{ id: projectId, clientId: c.user_id }}
              title="View project as this client"
              className="rounded p-1.5 text-[var(--charcoal)]/74 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <button onClick={() => setResetting(true)} title="Change password" className="rounded p-1.5 text-[var(--charcoal)]/74 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]">
              <KeyRound className="h-4 w-4" />
            </button>
            <button onClick={handleRemove} title="Remove client" className="rounded p-1.5 text-[var(--charcoal)]/70 hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]">
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
      notifyError(e, "Could not update Planner's Preference");
    },
    onSuccess: (_d, next) => {
      notifySuccess(next ? `Marked ${vendorName} as Planner's Preference` : `Removed Planner's Preference from ${vendorName}`);
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
      title={isPicked ? "Planner's Preference is on — click to remove" : "Mark as Planner's Preference"}
    >
      <Switch
        checked={isPicked}
        onCheckedChange={(next) => mutation.mutate(next)}
        className="data-[state=checked]:bg-[var(--terracotta)]"
      />
      <Sparkles className={isPicked ? "h-3 w-3 fill-current" : "h-3 w-3"} />
      <span>Planner's Pick</span>
    </label>
  );
}

function AssignedVendorsSection({
  projectId,
  vendors,
  selections,
  onRemove,
  quotesFor,
  setQuotesFor,
  detailVendor,
  setDetailVendor,
}: {
  projectId: string;
  vendors: any[];
  selections: Record<string, Selection[]>;
  onRemove: (id: string, name: string) => void;
  // Lifted to the parent tab component so the Quotes and Comments tabs can
  // open the same dialogs — a vendor's quotes/detail card should look the
  // same no matter which tab you jumped from.
  quotesFor: { id: string; name: string; category: string | null; autoOpenForm?: boolean } | null;
  setQuotesFor: (v: { id: string; name: string; category: string | null; autoOpenForm?: boolean } | null) => void;
  detailVendor: any | null;
  setDetailVendor: (v: any | null) => void;
}) {
  const [view, setView] = useState<"list" | "table">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<{ id: string; name: string } | null>(null);

  // Instagram previews for thumbnail strip + detail modal (deduped by react-query).
  const igVendorIds = useMemo(
    () => vendors.filter((v: any) => v.instagram_handle).map((v: any) => v.id as string),
    [vendors],
  );
  const { map: instagramPreviewMap, isLoading: instagramPreviewsLoading } =
    useInstagramPreviewsBulk(igVendorIds);
  const igVendorsForEnsure = useMemo(
    () =>
      vendors
        .filter((v: any) => v.instagram_handle)
        .map((v: any) => ({ id: v.id as string, instagram_handle: v.instagram_handle as string })),
    [vendors],
  );
  useAutoEnsureMissingPreviews(igVendorsForEnsure, instagramPreviewMap);

  // Multi-column sort for the table view. Click a header to cycle:
  // not-sorted → asc → desc → removed. Multiple columns combine in click order.
  type SortKey = "vendor" | "category" | "quote";
  const [sorts, setSorts] = useState<{ key: SortKey; dir: "asc" | "desc" }[]>([]);
  const toggleSort = (key: SortKey) => {
    setSorts((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx === -1) return [...prev, { key, dir: "asc" }];
      const cur = prev[idx];
      const next = [...prev];
      if (cur.dir === "asc") next[idx] = { key, dir: "desc" };
      else next.splice(idx, 1);
      return next;
    });
  };
  const sortInfo = (key: SortKey) => {
    const idx = sorts.findIndex((s) => s.key === key);
    return idx === -1 ? null : { dir: sorts[idx].dir, order: idx + 1 };
  };

  // Per-column filters (multi-select). Empty array means "no filter".
  const [catFilter, setCatFilter] = useState<string[]>([]);
  const [locFilter, setLocFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v: any) => { if (v.category) set.add(v.category); });
    return Array.from(set).sort().map((c) => ({ value: c, label: c }));
  }, [vendors]);
  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v: any) => { if (v.location) set.add(v.location); });
    return Array.from(set).sort().map((c) => ({ value: c, label: c }));
  }, [vendors]);
  const statusOptions = useMemo(
    () => [
      ...CLIENT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label, dot: o.dot })),
      { value: "__none__", label: "No response yet", dot: "#9ca3af" },
    ],
    [],
  );

  const filteredVendors = useMemo(() => {
    return vendors.filter((v: any) => {
      if (catFilter.length && !catFilter.includes(v.category)) return false;
      if (locFilter.length && !locFilter.includes(v.location)) return false;
      if (statusFilter.length) {
        const rows = selections[v.id] ?? [];
        const statuses = rows.map((r) => r.status);
        const wantNone = statusFilter.includes("__none__");
        const matchStatus = statuses.some((s) => statusFilter.includes(s));
        if (!(matchStatus || (wantNone && statuses.length === 0))) return false;
      }
      return true;
    });
  }, [vendors, catFilter, locFilter, statusFilter, selections]);

  // Fetch quotes for every vendor (used by the table to sort by quote amount).
  // Shares query keys + 30s staleTime with VendorQuotesPill, so React Query
  // dedupes — no extra network when toggling views.
  const quoteQueries = useQueries({
    queries: vendors.map((v: any) => ({
      queryKey: ["project-vendor-quotes", projectId, v.id],
      queryFn: () => listProjectVendorQuotes(projectId, v.id),
      staleTime: 30_000,
      enabled: view === "table",
    })),
  });
  const quoteAmountByVendor = useMemo(() => {
    const map: Record<string, number> = {};
    vendors.forEach((v: any, i: number) => {
      const qs = (quoteQueries[i]?.data as any[]) ?? [];
      if (qs.length === 0) {
        map[v.id] = 0;
        return;
      }
      const closed = qs.find((q) => q.is_final || q.status === "closed");
      if (closed && closed.closed_amount != null) {
        map[v.id] = Number(closed.closed_amount);
        return;
      }
      const amounts = qs.map((q) => Number(q.quote_amount ?? 0)).filter((n) => !Number.isNaN(n));
      map[v.id] = amounts.length ? Math.max(...amounts) : 0;
    });
    return map;
  }, [vendors, quoteQueries]);

  const hasClosedByVendor = useMemo(() => {
    const map: Record<string, boolean> = {};
    vendors.forEach((v: any, i: number) => {
      const qs = (quoteQueries[i]?.data as any[]) ?? [];
      map[v.id] = qs.some((q) => q.is_final || q.status === "closed");
    });
    return map;
  }, [vendors, quoteQueries]);

  const sortedVendors = useMemo(() => {
    const arr = [...filteredVendors];
    arr.sort((a: any, b: any) => {
      // Closed-quote vendors always float to the top of the table.
      const ac = hasClosedByVendor[a.id] ? 1 : 0;
      const bc = hasClosedByVendor[b.id] ? 1 : 0;
      if (ac !== bc) return bc - ac;
      for (const s of sorts) {
        let av: string | number = "";
        let bv: string | number = "";
        if (s.key === "vendor") {
          av = (a.vendor_name ?? "").toLowerCase();
          bv = (b.vendor_name ?? "").toLowerCase();
        } else if (s.key === "category") {
          av = (a.category ?? "").toLowerCase();
          bv = (b.category ?? "").toLowerCase();
        } else if (s.key === "quote") {
          av = quoteAmountByVendor[a.id] ?? 0;
          bv = quoteAmountByVendor[b.id] ?? 0;
        }
        if (av < bv) return s.dir === "asc" ? -1 : 1;
        if (av > bv) return s.dir === "asc" ? 1 : -1;
      }
      return 0;
    });
    return arr;
  }, [filteredVendors, sorts, quoteAmountByVendor, hasClosedByVendor]);


  const assignedVendorIds = useMemo(() => new Set(vendors.map((v: any) => v.id)), [vendors]);

  const activeFilterCount = catFilter.length + locFilter.length + statusFilter.length;

  return (
    <section>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <QuickAddVendorPanel
          projectId={projectId}
          assignedVendorIds={assignedVendorIds}
          className="w-full sm:max-w-[320px]"
        />
        <div className="flex shrink-0 items-center gap-2">
          {/* The table gets its filters from per-column headers (ColumnFilter);
              thumbnail view has no header row to attach those to, so it gets
              one combined filter button instead — same catFilter/locFilter/
              statusFilter state either way. */}
          {view === "list" && (
            <AssignedVendorsFilterButton
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              categoryOptions={categoryOptions}
              locationOptions={locationOptions}
              statusOptions={statusOptions}
              catFilter={catFilter}
              setCatFilter={setCatFilter}
              locFilter={locFilter}
              setLocFilter={setLocFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              activeCount={activeFilterCount}
            />
          )}
          <div className="inline-flex h-[30px] overflow-hidden rounded-md border border-[var(--border)] bg-white text-xs">
            <button
              onClick={() => setView("list")}
              className={`inline-flex items-center justify-center gap-1 px-2.5 ${view === "list" ? "bg-[var(--cream)] text-[var(--charcoal)]" : "text-[var(--charcoal)]/74 hover:bg-[var(--cream)]/60"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> <span>Thumbnail</span>
            </button>
            <button
              onClick={() => setView("table")}
              className={`inline-flex items-center justify-center gap-1 border-l border-[var(--border)] px-2.5 ${view === "table" ? "bg-[var(--cream)] text-[var(--charcoal)]" : "text-[var(--charcoal)]/74 hover:bg-[var(--cream)]/60"}`}
            >
              <TableIcon className="h-3.5 w-3.5" /> <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {vendors.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--champagne)] bg-white py-10 text-center text-sm text-[var(--charcoal)]/74">
          No vendors assigned to this project yet.
        </div>
      ) : view === "list" ? (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVendors.map((v: any) => {
            const rows = selections[v.id] ?? [];
            const primary = pickPrimary(rows);
            return (
              <AssignedVendorCard
                key={v.id}
                vendor={v}
                selectionRows={rows}
                primarySelection={primary}
                instagramPreview={instagramPreviewMap.get(v.id) ?? (instagramPreviewsLoading ? undefined : null)}
                onOpenDetail={() => setDetailVendor(v)}
                onRemove={() => onRemove(v.id, v.vendor_name)}
                onOpenComments={() => setCommentsFor({ id: v.id, name: v.vendor_name })}
                onAddQuote={() => setQuotesFor({ id: v.id, name: v.vendor_name, category: v.category ?? null, autoOpenForm: true })}
                quotesPill={
                  <VendorQuotesPill
                    projectId={projectId}
                    vendorId={v.id}
                    onOpen={() =>
                      setQuotesFor({ id: v.id, name: v.vendor_name, category: v.category ?? null, autoOpenForm: false })
                    }
                  />
                }
                saffronToggle={
                  <SaffronPickToggle
                    projectId={projectId}
                    vendorId={v.id}
                    vendorName={v.vendor_name}
                    isPicked={!!v.is_saffron_pick}
                  />
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[var(--charcoal)] text-[10px] uppercase tracking-widest text-[var(--cream)]/80">
              <tr>
                <SortableTh label="Vendor" sortKey="vendor" info={sortInfo("vendor")} onClick={toggleSort} />
                <SortableTh
                  label="Vendor Categories"
                  sortKey="category"
                  info={sortInfo("category")}
                  onClick={toggleSort}
                  filter={
                    <ColumnFilter
                      label="Vendor Categories"
                      options={categoryOptions}
                      selected={catFilter}
                      onChange={setCatFilter}
                    />
                  }
                />
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  <span className="inline-flex items-center gap-1">
                    Client Status
                    <ColumnFilter
                      label="Client Status"
                      options={statusOptions}
                      selected={statusFilter}
                      onChange={setStatusFilter}
                    />
                  </span>
                </th>
                <SortableTh label="Quotes" sortKey="quote" info={sortInfo("quote")} onClick={toggleSort} />
                <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedVendors.map((v: any) => {
                const rows = selections[v.id] ?? [];
                const primary = pickPrimary(rows);
                const isClosed = !!hasClosedByVendor[v.id];
                const rowClass = isClosed
                  ? "bg-emerald-500/15 hover:bg-emerald-500/20"
                  : v.is_saffron_pick
                    ? "bg-[var(--terracotta-soft)] hover:bg-[var(--terracotta)]/15"
                    : "hover:bg-[var(--cream)]/60";
                return (
                  <tr key={v.id} className={`border-t border-[var(--border)] ${rowClass}`}>
                    <td className="align-top px-3 py-2 text-left">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailVendor(v)}
                          className="text-left font-medium text-[var(--charcoal)] hover:text-[var(--terracotta)] hover:underline"
                        >
                          {v.vendor_name}
                        </button>
                      </div>
                      {(v.comment_count ?? 0) > 0 && (
                        <div className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-[var(--charcoal)]/70">
                          <MessageSquare className="h-3 w-3" /> {v.comment_count}
                        </div>
                      )}
                    </td>
                    <td className="align-top px-3 py-2 text-[var(--charcoal)]/85">
                      {v.category}
                      {v.subcategory && (
                        <div className="text-[10px] text-[var(--charcoal)]/70">{v.subcategory}</div>
                      )}
                    </td>
                    <td className="align-top px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <ClientStatusPill status={primary?.status ?? null} />
                        {rows.length > 1 && (
                          <span className="text-[10px] text-[var(--charcoal)]/70" title={rows.map((r) => `${r.display_name || r.email}: ${r.status}`).join("\n")}>
                            +{rows.length - 1}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="align-top px-3 py-2">
                      <VendorQuotesPill
                        projectId={projectId}
                        vendorId={v.id}
                        onOpen={() => setQuotesFor({ id: v.id, name: v.vendor_name, category: v.category ?? null, autoOpenForm: false })}
                      />
                    </td>
                    <td className="align-top px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--cream)]/70 p-0.5">
                        <button
                          onClick={() => setQuotesFor({ id: v.id, name: v.vendor_name, category: v.category ?? null, autoOpenForm: true })}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--charcoal)]/82 hover:bg-[var(--terracotta)] hover:text-[var(--cream)]"
                          title="Add a new quote"
                          aria-label="Add a new quote"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setCommentsFor({ id: v.id, name: v.vendor_name })}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--charcoal)]/82 hover:bg-[var(--cream)] hover:text-[var(--charcoal)]"
                          title="Comments"
                          aria-label="Comments"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onRemove(v.id, v.vendor_name)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--charcoal)]/74 hover:bg-red-500/15 hover:text-red-600"
                          title="Remove from project"
                          aria-label="Remove from project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>

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
                <div className="text-[10px] uppercase tracking-widest text-[var(--charcoal)]/70">
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

/**
 * One combined filter for the thumbnail view. The table gets per-column
 * filters via `ColumnFilter` in its header row; thumbnail has no header to
 * hang those off, so this bundles the same three facets (category, location,
 * client status) — same state, same options — into a single popover button.
 */
function AssignedVendorsFilterButton({
  open,
  onOpenChange,
  categoryOptions,
  locationOptions,
  statusOptions,
  catFilter,
  setCatFilter,
  locFilter,
  setLocFilter,
  statusFilter,
  setStatusFilter,
  activeCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoryOptions: ColumnFilterOption[];
  locationOptions: ColumnFilterOption[];
  statusOptions: ColumnFilterOption[];
  catFilter: string[];
  setCatFilter: (v: string[]) => void;
  locFilter: string[];
  setLocFilter: (v: string[]) => void;
  statusFilter: string[];
  setStatusFilter: (v: string[]) => void;
  activeCount: number;
}) {
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        title="Filter vendors"
        aria-label="Filter vendors"
        className={`relative inline-flex h-[30px] items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition ${
          activeCount > 0
            ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
            : "border-[var(--border)] bg-white text-[var(--charcoal)]/82 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
        }`}
      >
        <Filter className={`h-3.5 w-3.5 ${activeCount > 0 ? "fill-current" : ""}`} />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-[var(--terracotta)] px-1.5 text-[10px] font-bold text-[var(--cream)]">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 z-40 mt-1.5 w-64 rounded-md border border-[var(--border)] bg-white p-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--charcoal)]/70">
                Filter vendors
              </span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCatFilter([]);
                    setLocFilter([]);
                    setStatusFilter([]);
                  }}
                  className="rounded px-1.5 py-0.5 text-[10px] text-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
                >
                  Clear all
                </button>
              )}
            </div>

            <FilterSection label="Category" options={categoryOptions} selected={catFilter} onChange={setCatFilter} />
            <FilterSection label="Location" options={locationOptions} selected={locFilter} onChange={setLocFilter} />
            <FilterSection label="Client status" options={statusOptions} selected={statusFilter} onChange={setStatusFilter} />
          </div>
        </>
      )}
    </span>
  );
}

function FilterSection({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: ColumnFilterOption[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  if (options.length === 0) return null;
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((s) => s !== v));
    else onChange([...selected, v]);
  };
  return (
    <div className="mt-2.5 border-t border-[var(--border)] pt-2.5 first:mt-2 first:border-t-0 first:pt-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--charcoal)]/62">{label}</div>
      <div className="max-h-32 space-y-0.5 overflow-y-auto">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-[var(--charcoal)] hover:bg-[var(--cream)]"
          >
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={() => toggle(o.value)}
              className="h-3.5 w-3.5 accent-[var(--terracotta)]"
            />
            {o.dot && <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: o.dot }} />}
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  info,
  onClick,
  filter,
}: {
  label: string;
  sortKey: "vendor" | "category" | "quote";
  info: { dir: "asc" | "desc"; order: number } | null;
  onClick: (key: "vendor" | "category" | "quote") => void;
  filter?: React.ReactNode;
}) {
  const Icon = info ? (info.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => onClick(sortKey)}
          className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:text-[var(--terracotta)] ${info ? "text-[var(--terracotta)]" : ""}`}
          title="Click to sort. Click again to reverse, a third time to remove."
        >
          <span>{label}</span>
          <Icon className="h-3 w-3" />
          {info && (
            <span className="ml-0.5 rounded-full bg-[var(--terracotta)] px-1 text-[9px] font-bold text-[var(--cream)]">
              {info.order}
            </span>
          )}
        </button>
        {filter}
      </span>
    </th>
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
        <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--charcoal)]/70">
          <Paperclip className="h-2.5 w-2.5" /> {fileCount}
        </span>
      )}
    </div>
  );
}

interface ProjectHeaderProps {
  project: { id: string; bride_name: string; groom_name: string; wedding_date: string; notes: string | null; archived_at?: string | null };
}

function ProjectHeader({ project }: ProjectHeaderProps) {
  const isArchived = !!project.archived_at;
  useSetMobilePageTitle(`${project.bride_name} & ${project.groom_name}`);
  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="hidden font-display text-2xl text-[var(--charcoal)] sm:block sm:text-3xl">
            {project.bride_name} <span className="text-[var(--terracotta)]">&amp;</span> {project.groom_name}
          </h1>
          {isArchived && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--charcoal)]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--charcoal)]/82">
              <Archive className="h-3 w-3" /> Archived
            </span>
          )}
        </div>
        <div className="mt-1 hidden items-center gap-1.5 text-sm text-[var(--charcoal)]/78 sm:flex">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(project.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </div>
        {project.notes && <p className="mt-2 text-sm text-[var(--charcoal)]/82 whitespace-pre-wrap">{project.notes}</p>}
      </div>
    </div>
  );
}

