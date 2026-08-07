import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Pencil, Trash2, Check, AlertTriangle, Loader2, Tag, Plus } from "lucide-react";
import {
  addCustomCategory,
  deleteCategory,
  renameCategory,
  useAllCategories,
} from "@/lib/categories";
import type { Vendor } from "@/lib/vendor-types";
import { useIsAdmin } from "@/lib/auth";

interface CategoryManagerProps {
  vendors: Vendor[];
  onClose: () => void;
}

export function CategoryManager({ vendors, onClose }: CategoryManagerProps) {
  const categories = useAllCategories();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    return vendors.reduce<Record<string, number>>((acc, v) => {
      acc[v.category] = (acc[v.category] ?? 0) + 1;
      return acc;
    }, {});
  }, [vendors]);

  const beginRename = (name: string) => {
    setEditing(name);
    setDraft(name);
    setError(null);
    setConfirmingDelete(null);
  };

  const cancelRename = () => {
    setEditing(null);
    setDraft("");
    setError(null);
  };

  const saveRename = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const res = await renameCategory(editing, draft);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not rename");
      return;
    }
    cancelRename();
    qc.invalidateQueries({ queryKey: ["vendors"] });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    const res = await addCustomCategory(newName);
    setAdding(false);
    if (!res.ok) {
      setError(res.error ?? "Could not add category");
      return;
    }
    setNewName("");
  };

  const doDelete = async (name: string) => {
    setBusy(true);
    setError(null);
    const res = await deleteCategory(name);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not delete");
      return;
    }
    setConfirmingDelete(null);
    qc.invalidateQueries({ queryKey: ["vendors"] });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-[var(--cream)] text-[var(--charcoal)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Tag className="h-4 w-4 text-[var(--terracotta)]" /> Manage Categories
          </h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[var(--cream-deep)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 text-xs text-[var(--charcoal)]/78">
          Renaming a category updates every vendor using it. Deleting reassigns
          its vendors to <strong>Non-Specified</strong>.
        </div>

        <form onSubmit={handleAdd} className="mx-5 mb-3 flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name…"
            disabled={adding}
            className="flex-1 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm focus:border-[var(--terracotta)] focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-2.5 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
        </form>

        {error && (
          <div className="mx-5 mb-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <ul className="max-h-[55vh] divide-y divide-[var(--border)] overflow-y-auto">
          {categories.map((c) => {
            const count = counts[c] ?? 0;
            const isEditing = editing === c;
            const isConfirming = confirmingDelete === c;
            return (
              <li key={c} className="flex items-center gap-2 px-5 py-2.5">
                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename();
                        if (e.key === "Escape") cancelRename();
                      }}
                      disabled={busy}
                      className="flex-1 rounded-md border border-[var(--terracotta)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terracotta)]/30"
                    />
                    <button
                      onClick={saveRename}
                      disabled={busy || !draft.trim()}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-2.5 py-1 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Save
                    </button>
                    <button
                      onClick={cancelRename}
                      disabled={busy}
                      className="rounded-md px-2.5 py-1 text-xs hover:bg-[var(--cream-deep)]"
                    >
                      Cancel
                    </button>
                  </>
                ) : isConfirming ? (
                  <>
                    <span className="flex-1 truncate text-sm text-red-700">
                      Delete “{c}”? {count > 0 && `${count} vendor${count === 1 ? "" : "s"} → Non-Specified`}
                    </span>
                    <button
                      onClick={() => doDelete(c)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(null)}
                      disabled={busy}
                      className="rounded-md px-2.5 py-1 text-xs hover:bg-[var(--cream-deep)]"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{c}</span>
                    <span className="shrink-0 rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] text-[var(--charcoal)]/74">
                      {count}
                    </span>
                    <button
                      onClick={() => beginRename(c)}
                      title="Rename"
                      className="rounded-md p-1.5 text-[var(--charcoal)]/74 hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmingDelete(c)}
                        title="Delete"
                        className="rounded-md p-1.5 text-[var(--charcoal)]/74 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end border-t border-[var(--border)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--terracotta)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
