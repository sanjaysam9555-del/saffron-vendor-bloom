import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { KeyRound, Trash2, UserPlus, Pencil, Check, X, Users, ChevronDown, UserCog } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "@/components/AuthGate";
import { AdminSectionBackBar } from "@/components/admin/AdminSectionBackBar";
import { useAuth } from "@/lib/auth";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonBlock } from "@/components/ui/LoadingState";
import {
  listUsers,
  createEmployee,
  setUserPassword,
  setUserDisplayName,
  deleteUser,
} from "@/lib/admin-users.functions";
import { listProjectsOverview, createProjectClient } from "@/lib/projects.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Manage Users — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin>
      <AdminUsersPage />
    </AuthGate>
  ),
});

/** Team rows shown before "Show all". */
const TEAM_PREVIEW_COUNT = 4;

type Row = {
  id: string;
  email: string;
  role: "admin" | "employee" | "client";
  display_name: string;
  created_at: string;
  projects: string[];
};

function AdminUsersPage() {
  const { user, session, role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Team = staff only; client accounts live in the Client Credentials
  // section below instead — listUsers() returns everyone with a role,
  // splitting here keeps "Team" meaning exactly what it says.
  const staffRows = useMemo(() => rows.filter((r) => r.role !== "client"), [rows]);
  const clientRows = useMemo(() => rows.filter((r) => r.role === "client"), [rows]);

  // Show a preview of the team by default; the rest is one click away.
  const [usersOpen, setUsersOpen] = useState(false);
  const visibleRows = usersOpen ? staffRows : staffRows.slice(0, TEAM_PREVIEW_COUNT);

  // create employee state
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await listUsers();
      setRows(Array.isArray(data) ? (data as Row[]) : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token && role === "admin") {
      refresh();
    }
  }, [session?.access_token, role]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const email = newEmail.trim().toLowerCase();
    if (!email.endsWith("@saffronevents.in")) {
      const msg = "Staff accounts must use an @saffronevents.in email";
      setErr(msg);
      notifyError(new Error(msg), msg);
      return;
    }
    setCreating(true);
    try {
      await createEmployee({ data: { email, password: newPwd, display_name: (newName.trim() || email.split("@")[0]) } });

      notifySuccess("Employee created");
      setNewEmail("");
      setNewPwd("");
      setNewName("");
      setShowCreate(false);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create employee";
      setErr(msg);
      notifyError(e, msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      <AdminSectionBackBar />

      {/* Secondary toolbar */}
      <div className="hidden h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70 sm:block">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="text-sm text-[var(--charcoal)]/70">Create staff and client accounts, and manage their access.</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-6 hidden sm:block">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Manage Users
          </h1>
        </div>

        {err && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="space-y-6">
          {/* ── Team ── */}
          <SectionCard
            icon={<Users className="h-4 w-4" />}
            title="Team"
            description="Employees who can sign in to the studio dashboard."
            meta={loading ? undefined : `${staffRows.length} member${staffRows.length === 1 ? "" : "s"}`}
            action={
              <button
                onClick={() => setShowCreate((s) => !s)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90"
              >
                <UserPlus className="h-4 w-4" /> Create employee
              </button>
            }
          >
            {showCreate && (
              <form onSubmit={handleCreate} className="grid gap-2 border-b border-[var(--border)] bg-[var(--cream)]/40 p-4 sm:grid-cols-3">
                <input className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Display name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" type="email" required placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <input className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" required minLength={6} placeholder="Password (min 6)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
                <p className="sm:col-span-3 text-xs text-[var(--charcoal)]/74">
                  The employee will use this password to sign in. They cannot change it — only you can update it from this page.
                </p>
                <div className="sm:col-span-3 flex gap-2">
                  <button type="submit" disabled={creating} className="flex-1 rounded-md bg-[var(--charcoal)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50">
                    {creating ? "Creating…" : "Create"}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm hover:bg-[var(--cream)]">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : staffRows.length === 0 ? (
              <EmptyState
                compact
                icon={<Users />}
                title="No staff yet"
                description="Create your first employee account above."
              />
            ) : (
              <>
                <div className="overflow-x-auto touch-pan-x" style={{ WebkitOverflowScrolling: "touch" }}>
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
                      <tr>
                        <th className="px-4 py-2.5">Name</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((r) => (
                        <UserRow key={r.id} row={r} isSelf={r.id === user?.id} onChanged={refresh} onError={setErr} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Explicit expand control — a preview is always visible, so
                    there is nothing hidden behind an unlabelled chevron. */}
                {staffRows.length > TEAM_PREVIEW_COUNT && (
                  <button
                    onClick={() => setUsersOpen((o) => !o)}
                    aria-expanded={usersOpen}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--border)] px-4 py-2.5 text-xs font-medium text-[var(--terracotta)] transition hover:bg-[var(--cream)]/60"
                  >
                    {usersOpen
                      ? "Show fewer"
                      : `Show all ${staffRows.length} members`}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${usersOpen ? "rotate-180" : ""}`} />
                  </button>
                )}
              </>
            )}
          </SectionCard>

          {/* ── Client Credentials ── */}
          <CreateClientCredentialsCard clients={clientRows} loading={loading} onChanged={refresh} onError={setErr} />
        </div>
      </div>
    </div>
  );
}

/**
 * One settings block: icon + title + description on the left, a single action
 * on the right, content below. Section titles deliberately carry no
 * `brand-line` — that accent belongs to the page heading alone.
 */
export function SectionCard({
  icon,
  title,
  description,
  meta,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-lg bg-[var(--terracotta-soft)] p-2 text-[var(--terracotta)]">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="font-display text-lg leading-tight text-[var(--charcoal)]">{title}</h2>
              {meta && <span className="text-xs text-[var(--charcoal)]/62">{meta}</span>}
            </div>
            <p className="truncate text-xs text-[var(--charcoal)]/70">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 sm:px-5">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/70">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold text-[var(--terracotta)]">{value}</div>
    </div>
  );
}

function UserRow({ row, isSelf, onChanged, onError }: { row: Row; isSelf: boolean; onChanged: () => void; onError: (m: string) => void }) {
  const confirmDelete = useConfirmDelete();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.display_name);
  const [resetting, setResetting] = useState(false);
  const [newPwd, setNewPwd] = useState("");

  const saveName = async () => {
    try {
      await setUserDisplayName({ data: { user_id: row.id, display_name: name } });
      notifySuccess("Name updated");
      setEditing(false);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      onError(msg);
      notifyError(e, msg);
    }
  };

  const savePwd = async () => {
    try {
      await setUserPassword({ data: { user_id: row.id, password: newPwd } });
      notifySuccess("Password updated", { description: "User has been signed out of all sessions." });
      setNewPwd("");
      setResetting(false);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      onError(msg);
      notifyError(e, msg);
    }
  };

  const handleDelete = async () => {
    const ok = await confirmDelete({
      title: `Delete ${row.email}?`,
      description: "Their account will be removed. This cannot be undone.",
      confirmLabel: "Delete user",
    });
    if (!ok) return;
    try {
      await deleteUser({ data: { user_id: row.id } });
      notifySuccess(`Deleted ${row.email}`);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      onError(msg);
      notifyError(e, msg);
    }
  };

  return (
    <tr className="border-t border-[var(--border)] transition-colors hover:bg-[var(--cream)]/60">
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <input className="rounded border border-[var(--border)] px-2 py-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            <button onClick={saveName} className="rounded p-1 text-green-700 hover:bg-green-50"><Check className="h-4 w-4" /></button>
            <button onClick={() => { setEditing(false); setName(row.display_name); }} className="rounded p-1 text-[var(--charcoal)]/74 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>{row.display_name || "—"}</span>
            <button onClick={() => setEditing(true)} className="text-[var(--charcoal)]/58 hover:text-[var(--terracotta)]"><Pencil className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--charcoal)]/82">{row.email}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.role === "admin" ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)]" : "bg-[var(--cream)] text-[var(--charcoal)]/82"}`}>
          {row.role}
        </span>
        {isSelf && <span className="ml-2 text-xs text-[var(--charcoal)]/58">(you)</span>}
      </td>
      <td className="px-4 py-3">
        {resetting ? (
          <div className="flex items-center justify-end gap-1">
            <input type="password" minLength={6} placeholder="New password" className="rounded border border-[var(--border)] px-2 py-1 text-sm" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <button onClick={savePwd} disabled={newPwd.length < 6} title="Sets the new password and signs the user out of all sessions" className="rounded bg-[var(--terracotta)] px-2 py-1 text-xs text-white disabled:opacity-50">Set</button>
            <button onClick={() => { setResetting(false); setNewPwd(""); }} className="rounded p-1 text-[var(--charcoal)]/74 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => setResetting(true)} title="Change password (signs user out)" className="rounded p-1.5 text-[var(--charcoal)]/74 transition-colors hover:bg-[var(--cream)] hover:text-[var(--terracotta)]">
              <KeyRound className="h-4 w-4" />
            </button>
            {!isSelf && (
              <button onClick={handleDelete} title="Delete user" className="rounded p-1.5 text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Create Client Credentials ────────────────────────────────────────────────
// Separate from Team: clients are scoped to a project (createProjectClient
// requires project_id), so this section adds a project picker in front of
// the same create-account flow used inside a project's detail page.

function CreateClientCredentialsCard({
  clients,
  loading,
  onChanged,
  onError,
}: {
  clients: Row[];
  loading: boolean;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjectsOverview(),
  });
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const sortedProjects = useMemo(
    () => [...projects].sort((a: any, b: any) => `${a.bride_name} ${a.groom_name}`.localeCompare(`${b.bride_name} ${b.groom_name}`)),
    [projects],
  );

  const reset = () => {
    setProjectId("");
    setName("");
    setEmail("");
    setPassword("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      notifyError(null, "Choose a project first");
      return;
    }
    setCreating(true);
    try {
      await createProjectClient({
        data: { project_id: projectId, email: email.trim(), password, display_name: name.trim() || email.split("@")[0] },
      });
      notifySuccess("Client account created");
      reset();
      setOpen(false);
    } catch (err) {
      notifyError(err, "Could not create client account");
    } finally {
      setCreating(false);
    }
  };

  return (
    <SectionCard
      icon={<UserCog className="h-4 w-4" />}
      title="Client Credentials"
      description="Sign-in accounts for couples to view their own project."
      meta={loading ? undefined : `${clients.length} client${clients.length === 1 ? "" : "s"}`}
      action={
        <button
          onClick={() => setOpen((s) => !s)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90"
        >
          <UserPlus className="h-4 w-4" /> Create client credentials
        </button>
      }
    >
      {open ? (
        <form onSubmit={handleCreate} className="grid gap-2 p-4 sm:grid-cols-2">
          <select
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm sm:col-span-2"
          >
            <option value="">{projectsLoading ? "Loading projects…" : "Select a project…"}</option>
            {sortedProjects.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.bride_name} & {p.groom_name} · {new Date(p.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {p.client_count > 0 ? ` · ${p.client_count} existing login${p.client_count === 1 ? "" : "s"}` : ""}
              </option>
            ))}
          </select>
          <input className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm sm:col-span-2" required minLength={6} placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-[var(--charcoal)]/74 sm:col-span-2">
            A project can have more than one client login (e.g. both partners). This account will only see the selected project.
          </p>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={creating} className="flex-1 rounded-md bg-[var(--charcoal)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50">
              {creating ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => { setOpen(false); reset(); }} className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm hover:bg-[var(--cream)]">
              Cancel
            </button>
          </div>
        </form>
      ) : loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-10 rounded-md" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          compact
          icon={<UserCog />}
          title="No client accounts yet"
          description="Create your first client login above."
        />
      ) : (
        <div className="overflow-x-auto touch-pan-x" style={{ WebkitOverflowScrolling: "touch" }}>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((r) => (
                <ClientRow key={r.id} row={r} onChanged={onChanged} onError={onError} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function ClientRow({ row, onChanged, onError }: { row: Row; onChanged: () => void; onError: (m: string) => void }) {
  const confirmDelete = useConfirmDelete();
  const [resetting, setResetting] = useState(false);
  const [newPwd, setNewPwd] = useState("");

  const savePwd = async () => {
    try {
      await setUserPassword({ data: { user_id: row.id, password: newPwd } });
      notifySuccess("Password updated", { description: "User has been signed out of all sessions." });
      setNewPwd("");
      setResetting(false);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      onError(msg);
      notifyError(e, msg);
    }
  };

  const handleDelete = async () => {
    const ok = await confirmDelete({
      title: `Delete ${row.email}?`,
      description: "Their account will be removed. This cannot be undone.",
      confirmLabel: "Delete user",
    });
    if (!ok) return;
    try {
      await deleteUser({ data: { user_id: row.id } });
      notifySuccess(`Deleted ${row.email}`);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      onError(msg);
      notifyError(e, msg);
    }
  };

  return (
    <tr className="border-t border-[var(--border)] transition-colors hover:bg-[var(--cream)]/60">
      <td className="px-4 py-3">{row.display_name || "—"}</td>
      <td className="px-4 py-3 text-[var(--charcoal)]/82">{row.email}</td>
      <td className="px-4 py-3 text-[var(--charcoal)]/82">
        {row.projects.length > 0 ? row.projects.join(", ") : <span className="text-[var(--charcoal)]/58">—</span>}
      </td>
      <td className="px-4 py-3">
        {resetting ? (
          <div className="flex items-center justify-end gap-1">
            <input type="password" minLength={6} placeholder="New password" className="rounded border border-[var(--border)] px-2 py-1 text-sm" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <button onClick={savePwd} disabled={newPwd.length < 6} title="Sets the new password and signs the user out of all sessions" className="rounded bg-[var(--terracotta)] px-2 py-1 text-xs text-white disabled:opacity-50">Set</button>
            <button onClick={() => { setResetting(false); setNewPwd(""); }} className="rounded p-1 text-[var(--charcoal)]/74 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => setResetting(true)} title="Change password (signs user out)" className="rounded p-1.5 text-[var(--charcoal)]/74 transition-colors hover:bg-[var(--cream)] hover:text-[var(--terracotta)]">
              <KeyRound className="h-4 w-4" />
            </button>
            <button onClick={handleDelete} title="Delete user" className="rounded p-1.5 text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
