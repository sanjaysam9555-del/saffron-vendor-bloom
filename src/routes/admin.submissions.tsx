import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Eye, Pencil, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { useVendors, useVendorMutations, useVendorModals } from "@/hooks/useVendorData";
import { VendorDetail } from "@/components/vendor/VendorDetail";
import { VendorForm } from "@/components/vendor/VendorForm";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/submissions")({
  head: () => ({
    meta: [
      { title: "Vendor Submissions — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate>
      <SubmissionsPage />
    </AuthGate>
  ),
});

function SubmissionsPage() {
  const { data: vendors = [], isLoading } = useVendors();
  const { create, update, remove } = useVendorMutations();
  const modals = useVendorModals();
  const [search, setSearch] = useState("");

  const submissions = useMemo(
    () => vendors.filter((v) => v.submitted_via_form),
    [vendors],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((v) =>
      [v.vendor_name, v.category, v.location, v.contact_number, v.email]
        .filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [submissions, search]);

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const thisWeek = submissions.filter((v) => now - new Date(v.date_added).getTime() < weekMs).length;
  const thisMonth = submissions.filter((v) => now - new Date(v.date_added).getTime() < monthMs).length;

  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of submissions) counts[v.category] = (counts[v.category] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [submissions]);

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--cream)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <div className="ml-auto text-xs text-[var(--charcoal)]/50">
            Public link: <code className="rounded bg-[var(--cream-deep)] px-1.5 py-0.5">/vendor-signup</code>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 animate-fade-up">
          <h1 className="brand-line font-display text-3xl font-semibold text-[var(--charcoal)]">
            Vendor Submissions
          </h1>
          <p className="mt-2 text-sm text-[var(--charcoal)]/60">
            Vendors who registered themselves through the public signup form.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total submissions" value={submissions.length} />
          <Stat label="This week" value={thisWeek} />
          <Stat label="This month" value={thisMonth} />
          <div className="rounded-lg border border-[var(--border)] bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">Top categories</div>
            {topCategories.length === 0 ? (
              <div className="mt-2 text-sm text-[var(--charcoal)]/50">—</div>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {topCategories.map(([cat, n]) => (
                  <li key={cat} className="flex items-center justify-between">
                    <span className="truncate text-[var(--charcoal)]/75">{cat}</span>
                    <span className="font-medium text-[var(--terracotta)]">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search submissions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-[var(--terracotta)] focus:outline-none focus:ring-1 focus:ring-[var(--terracotta)]"
          />
          <span className="text-xs text-[var(--charcoal)]/50">
            {filtered.length} of {submissions.length}
          </span>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-[var(--border)] bg-white p-12 text-center text-sm text-[var(--charcoal)]/50">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-white p-12 text-center">
            <div className="text-sm text-[var(--charcoal)]/60">
              {submissions.length === 0
                ? "No vendor self-submissions yet."
                : "No submissions match your search."}
            </div>
            {submissions.length === 0 && (
              <div className="mt-2 text-xs text-[var(--charcoal)]/50">
                Share <code className="rounded bg-[var(--cream-deep)] px-1.5 py-0.5">/vendor-signup</code> to start receiving submissions.
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--cream-deep)] text-left text-[10px] uppercase tracking-widest text-[var(--charcoal)]/55">
                <tr>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-t border-[var(--border)] hover:bg-[var(--cream-deep)]/40">
                    <td className="px-4 py-3 font-medium text-[var(--charcoal)]">{v.vendor_name}</td>
                    <td className="px-4 py-3 text-[var(--charcoal)]/75">{v.category}</td>
                    <td className="px-4 py-3 text-[var(--charcoal)]/75">{v.location ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--charcoal)]/75">{v.contact_number ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--charcoal)]/60">
                      {new Date(v.date_added).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => modals.openDetail(v)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                        <button
                          onClick={() => modals.openEdit(v)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modals.state.detail && (
        <VendorDetail
          vendor={modals.state.detail}
          onClose={modals.closeDetail}
          onEdit={() => modals.openEdit(modals.state.detail!)}
          onDelete={async () => {
            await remove.mutateAsync(modals.state.detail!.id);
            modals.closeDetail();
          }}
        />
      )}

      {modals.state.formOpen && (
        <VendorForm
          open={modals.state.formOpen}
          initial={modals.state.editing ?? modals.state.prefill}
          onClose={modals.closeForm}
          onSubmit={async (input) => {
            if (modals.state.editing) {
              const v = await update.mutateAsync({ id: modals.state.editing.id, input });
              toast.success("Vendor updated");
              return v;
            }
            const v = await create.mutateAsync(input);
            toast.success("Vendor added");
            return v;
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold text-[var(--terracotta)]">{value}</div>
    </div>
  );
}
