import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Trash2, UserPlus, Pencil, Check, X } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth";
import {
  listUsers,
  createEmployee,
  setUserPassword,
  setUserDisplayName,
  deleteUser,
} from "@/server/admin-users.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "User Management — Saffron Planning Studio" }] }),
  component: () => (
    <AuthGate requireAdmin>
      <AdminUsersPage />
    </AuthGate>
  ),
});

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
    setCreating(true);
    try {
      await createEmployee({ data: { email: newEmail.trim(), password: newPwd, display_name: (newName.trim() || newEmail.split("@")[0]) } });
      setNewEmail("");
      setNewPwd("");
      setNewName("");
      setShowCreate(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create employee");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)] px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-[var(--charcoal)]">User Management</h1>
            <p className="text-sm text-[var(--charcoal)]/60">Create employees and manage their access.</p>
          </div>
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            <UserPlus className="h-4 w-4" /> Create Employee
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="mt-4 grid gap-2 rounded-lg border border-[var(--border)] bg-white p-4 sm:grid-cols-3">
            <input className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" placeholder="Display name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" type="email" required placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <input className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" required minLength={6} placeholder="Password (min 6)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <p className="sm:col-span-3 text-xs text-[var(--charcoal)]/60">
              The employee will use this password to sign in. They cannot change it — only you can update it from this page.
            </p>
            <div className="sm:col-span-3 flex gap-2">
              <button type="submit" disabled={creating} className="flex-1 rounded-md bg-[var(--charcoal)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50">
                {creating ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--cream)]">
                Cancel
              </button>
            </div>
          </form>
        )}

        {err && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-6 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          {loading ? (
            <div className="p-6 text-sm text-[var(--charcoal)]/60">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-[var(--cream)] text-left text-xs uppercase tracking-wider text-[var(--charcoal)]/60">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <UserRow key={r.id} row={r} isSelf={r.id === user?.id} onChanged={refresh} onError={setErr} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserRow({ row, isSelf, onChanged, onError }: { row: Row; isSelf: boolean; onChanged: () => void; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.display_name);
  const [resetting, setResetting] = useState(false);
  const [newPwd, setNewPwd] = useState("");

  const saveName = async () => {
    try {
      await setUserDisplayName({ data: { user_id: row.id, display_name: name } });
      setEditing(false);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed");
    }
  };

  const savePwd = async () => {
    try {
      await setUserPassword({ data: { user_id: row.id, password: newPwd } });
      setNewPwd("");
      setResetting(false);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${row.email}? This cannot be undone.`)) return;
    try {
      await deleteUser({ data: { user_id: row.id } });
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed");
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
