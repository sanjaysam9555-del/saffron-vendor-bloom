import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { KeyRound, Trash2, UserPlus, Pencil, Check, X, Users, ArrowRight, Instagram, ChevronDown, Inbox } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { EmptyState } from "@/components/ui/empty-state";
import { useVendors } from "@/hooks/useVendorData";
import { BulkInstagramSyncDialog } from "@/components/vendor/BulkInstagramSyncDialog";
import {
  listUsers,
  createEmployee,
  setUserPassword,
  setUserDisplayName,
  deleteUser,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Admin — Saffron Planning Studio" },
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
  role: "admin" | "employee";
  display_name: string;
  created_at: string;
};

function AdminUsersPage() {
  const { user, session, role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Show a preview of the team by default; the rest is one click away.
  const [usersOpen, setUsersOpen] = useState(false);
  const visibleRows = usersOpen ? rows : rows.slice(0, TEAM_PREVIEW_COUNT);

  // create employee state
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Submissions stats
  const { data: vendors = [] } = useVendors();
  const submissionStats = useMemo(() => {
    const subs = vendors.filter((v) => v.submitted_via_form);
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    return {
      total: subs.length,
      week: subs.filter((v) => now - new Date(v.date_added).getTime() < weekMs).length,
      month: subs.filter((v) => now - new Date(v.date_added).getTime() < monthMs).length,
    };
  }, [vendors]);

  // Instagram sync dialog
  const [igSyncOpen, setIgSyncOpen] = useState(false);

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
    setCreating(true);
    try {
      await createEmployee({ data: { email: newEmail.trim(), password: newPwd, display_name: (newName.trim() || newEmail.split("@")[0]) } });
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
      {/* Secondary toolbar */}
      <div className="h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="text-sm text-[var(--charcoal)]/55">Create employees and manage their access.</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        {/* Page heading — the only brand-line on the page; section cards
            below carry their own icon + title instead. */}
        <div className="mb-6">
          <h1 className="brand-line hidden font-display text-xl font-semibold text-[var(--charcoal)] sm:block sm:text-2xl">
            Admin
          </h1>
        </div>

        {err && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="space-y-6">
          {/* ── Team ── */}
          <SectionCard
            icon={<Users className="h-4 w-4" />}
            title="Team"
            description="Employees who can sign in to the studio dashboard."
            meta={loading ? undefined : `${rows.length} member${rows.length === 1 ? "" : "s"}`}
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
                <p className="sm:col-span-3 text-xs text-[var(--charcoal)]/60">
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
                  <div key={i} className="h-10 animate-pulse rounded-md bg-[var(--cream-deep)]/60" />
                ))}
              </div>
            ) : rows.length === 0 ? (
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
                {rows.length > TEAM_PREVIEW_COUNT && (
                  <button
                    onClick={() => setUsersOpen((o) => !o)}
                    aria-expanded={usersOpen}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--border)] px-4 py-2.5 text-xs font-medium text-[var(--terracotta)] transition hover:bg-[var(--cream)]/60"
                  >
                    {usersOpen
                      ? "Show fewer"
                      : `Show all ${rows.length} members`}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${usersOpen ? "rotate-180" : ""}`} />
                  </button>
                )}
              </>
            )}
          </SectionCard>

          {/* ── Vendor Submissions ── */}
          <SectionCard
            icon={<Inbox className="h-4 w-4" />}
            title="Vendor Submissions"
            description="Vendors who registered through the public signup form."
            action={
              <Link
                to="/admin/submissions"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--charcoal)]/75 transition hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
            <div className="grid divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <StatTile label="Total submissions" value={submissionStats.total} />
              <StatTile label="This week" value={submissionStats.week} />
              <StatTile label="This month" value={submissionStats.month} />
            </div>
          </SectionCard>

          {/* ── Instagram Sync ── */}
          <SectionCard
            icon={<Instagram className="h-4 w-4" />}
            title="Instagram Sync"
            description="Fetch Instagram previews for vendors that are missing or stale."
            action={
              <button
                onClick={() => setIgSyncOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90"
              >
                <Instagram className="h-4 w-4" /> Sync now
              </button>
            }
          >
            <p className="px-4 py-4 text-sm text-[var(--charcoal)]/65 sm:px-5">
              Runs in the background and refreshes profile photos and recent posts for
              vendors with an Instagram handle.
            </p>
          </SectionCard>
        </div>
      </div>

      <BulkInstagramSyncDialog open={igSyncOpen} onOpenChange={setIgSyncOpen} />
    </div>
  );
}

/**
 * One settings block: icon + title + description on the left, a single action
 * on the right, content below. Section titles deliberately carry no
 * `brand-line` — that accent belongs to the page heading alone.
 */
function SectionCard({
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
              {meta && <span className="text-xs text-[var(--charcoal)]/45">{meta}</span>}
            </div>
            <p className="truncate text-xs text-[var(--charcoal)]/55">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 sm:px-5">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">{label}</div>
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
    <tr className="border-t border-[var(--border)]">
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <input className="rounded border border-[var(--border)] px-2 py-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            <button onClick={saveName} className="rounded p-1 text-green-700 hover:bg-green-50"><Check className="h-4 w-4" /></button>
            <button onClick={() => { setEditing(false); setName(row.display_name); }} className="rounded p-1 text-[var(--charcoal)]/60 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>{row.display_name || "—"}</span>
            <button onClick={() => setEditing(true)} className="text-[var(--charcoal)]/40 hover:text-[var(--terracotta)]"><Pencil className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--charcoal)]/70">{row.email}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.role === "admin" ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)]" : "bg-[var(--cream)] text-[var(--charcoal)]/70"}`}>
          {row.role}
        </span>
        {isSelf && <span className="ml-2 text-xs text-[var(--charcoal)]/40">(you)</span>}
      </td>
      <td className="px-4 py-3">
        {resetting ? (
          <div className="flex items-center justify-end gap-1">
            <input type="password" minLength={6} placeholder="New password" className="rounded border border-[var(--border)] px-2 py-1 text-sm" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <button onClick={savePwd} disabled={newPwd.length < 6} title="Sets the new password and signs the user out of all sessions" className="rounded bg-[var(--terracotta)] px-2 py-1 text-xs text-white disabled:opacity-50">Set</button>
            <button onClick={() => { setResetting(false); setNewPwd(""); }} className="rounded p-1 text-[var(--charcoal)]/60 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => setResetting(true)} title="Change password (signs user out)" className="rounded p-1.5 text-[var(--charcoal)]/60 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]">
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
