import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Tag, Inbox, Instagram, ArrowRight, Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { AdminSectionBackBar } from "@/components/admin/AdminSectionBackBar";
import { SectionCard, StatTile } from "@/routes/admin.users";
import { useVendors } from "@/hooks/useVendorData";
import { useAllCategories, addCustomCategory, renameCategory, deleteCategory, getCategoryColor } from "@/lib/categories";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { BulkInstagramSyncDialog } from "@/components/vendor/BulkInstagramSyncDialog";

export const Route = createFileRoute("/admin/manage-vendors")({
  head: () => ({
    meta: [
      { title: "Manage Vendors — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin>
      <ManageVendorsPage />
    </AuthGate>
  ),
});

function ManageVendorsPage() {
  const { data: vendors = [] } = useVendors();
  const categories = useAllCategories();
  const [igSyncOpen, setIgSyncOpen] = useState(false);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of vendors) {
      counts.set(v.category, (counts.get(v.category) ?? 0) + 1);
    }
    return counts;
  }, [vendors]);

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

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      <AdminSectionBackBar />

      <div className="hidden h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70 sm:block">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="text-sm text-[var(--charcoal)]/55">Categories, incoming submissions, and Instagram sync.</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-6 hidden sm:block">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Manage Vendors
          </h1>
        </div>

        <div className="space-y-6">
          {/* ── Vendor Categories ── */}
          <CategoriesCard categories={categories} categoryCounts={categoryCounts} />

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
            description="Fetch Instagram previews for vendors that don't have one yet."
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
              Runs in the background and fetches profile photos and recent posts for vendors that have never had a
              preview fetched. Vendors with an existing preview are never touched here — refresh one individually
              from that vendor's own card.
            </p>
          </SectionCard>
        </div>
      </div>

      <BulkInstagramSyncDialog open={igSyncOpen} onOpenChange={setIgSyncOpen} />
    </div>
  );
}

// ── Vendor Categories ────────────────────────────────────────────────────────
// Inline list — no modal. Rename updates every vendor using that category;
// delete reassigns its vendors to "Non-Specified" (itself a category, so it
// can never be renamed away entirely).

function CategoriesCard({
  categories,
  categoryCounts,
}: {
  categories: string[];
  categoryCounts: Map<string, number>;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await addCustomCategory(trimmed);
      if (!res.ok) throw new Error(res.error ?? "Failed to add category");
      notifySuccess(`Added "${trimmed}"`);
      setNewName("");
      setAdding(false);
    } catch (err) {
      notifyError(err, "Could not add category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      icon={<Tag className="h-4 w-4" />}
      title="Vendor Categories"
      description="Add, rename, or delete the categories vendors are grouped by."
      meta={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
      action={
        <button
          onClick={() => setAdding((s) => !s)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90"
        >
          <Plus className="h-4 w-4" /> Add category
        </button>
      }
    >
      {adding && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--cream)]/40 p-4">
          <input
            autoFocus
            className="flex-1 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" disabled={saving || !newName.trim()} className="rounded-md bg-[var(--charcoal)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Adding…" : "Add"}
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewName(""); }} className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm hover:bg-[var(--cream)]">
            Cancel
          </button>
        </form>
      )}
      <ul className="divide-y divide-[var(--border)]">
        {categories.map((name) => (
          <CategoryRow key={name} name={name} count={categoryCounts.get(name) ?? 0} />
        ))}
      </ul>
    </SectionCard>
  );
}

function CategoryRow({ name, count }: { name: string; count: number }) {
  const confirmDelete = useConfirmDelete();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const isFallback = name === "Non-Specified";

  const saveRename = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    setSaving(true);
    try {
      const res = await renameCategory(name, trimmed);
      if (!res.ok) throw new Error(res.error ?? "Failed to rename category");
      notifySuccess(`Renamed to "${trimmed}"`);
      setEditing(false);
    } catch (err) {
      notifyError(err, "Could not rename category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirmDelete({
      title: `Delete "${name}"?`,
      description:
        count > 0
          ? `${count} vendor${count === 1 ? "" : "s"} using this category will be moved to "Non-Specified".`
          : "This cannot be undone.",
      confirmLabel: "Delete category",
    });
    if (!ok) return;
    try {
      const res = await deleteCategory(name);
      if (!res.ok) throw new Error(res.error ?? "Failed to delete category");
      notifySuccess(`Deleted "${name}"`);
    } catch (err) {
      notifyError(err, "Could not delete category");
    }
  };

  // Reuse the same hue as this category's badge elsewhere in the app (vendor
  // cards, filters) so the color carries a consistent meaning here too —
  // recognition, not decoration.
  // Tailwind's scanner only picks up literal class strings in source, so a
  // runtime-built `bg-[...]` class here would silently produce no CSS.
  // Extract the raw color and apply it via inline style instead.
  const swatchColor = getCategoryColor(name)
    .text.replace(/^text-\[(.+)\]$/, "$1")
    .replace(/_/g, " ");

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--cream)]/60 sm:px-5">
      {editing ? (
        <div className="flex flex-1 items-center gap-1">
          <input
            autoFocus
            className="flex-1 rounded border border-[var(--border)] px-2 py-1 text-sm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button onClick={saveRename} disabled={saving} className="rounded p-1 text-green-700 hover:bg-green-50"><Check className="h-4 w-4" /></button>
          <button onClick={() => { setEditing(false); setValue(name); }} className="rounded p-1 text-[var(--charcoal)]/60 hover:bg-[var(--cream)]"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatchColor }} aria-hidden />
          <span className="flex-1 truncate text-sm text-[var(--charcoal)]">{name}</span>
          <span className="shrink-0 text-xs text-[var(--charcoal)]/45">
            {count} vendor{count === 1 ? "" : "s"}
          </span>
          <button onClick={() => setEditing(true)} title="Rename category" className="shrink-0 rounded p-1.5 text-[var(--charcoal)]/50 transition-colors hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {!isFallback && (
            <button onClick={handleDelete} title="Delete category" className="shrink-0 rounded p-1.5 text-red-600 transition-colors hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </li>
  );
}
