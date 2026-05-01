import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Calendar, Heart } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { listProjects, createProject } from "@/server/projects.functions";

export const Route = createFileRoute("/admin/projects/")({
  head: () => ({ meta: [{ title: "Projects — Saffron Events" }] }),
  component: () => (
    <AuthGate>
      <ProjectsListPage />
    </AuthGate>
  ),
});

function ProjectsListPage() {
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [bride, setBride] = useState("");
  const [groom, setGroom] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await createProject({
        data: {
          bride_name: bride.trim(),
          groom_name: groom.trim(),
          wedding_date: date,
          notes: notes.trim() || null,
        },
      });
      setBride("");
      setGroom("");
      setDate("");
      setNotes("");
      setShowCreate(false);
      await qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)] px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-[var(--charcoal)]">Projects</h1>
            <p className="text-sm text-[var(--charcoal)]/60">
              Each project is one wedding. Add a client login and assign vendors to share with them.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            <Plus className="h-4 w-4" /> New Project
          </button>
        </div>

        {showCreate && (
          <form onSubmit={submit} className="mt-4 grid gap-2 rounded-lg border border-[var(--border)] bg-white p-4 sm:grid-cols-3">
            <input className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" required placeholder="Bride name" value={bride} onChange={(e) => setBride(e.target.value)} />
            <input className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" required placeholder="Groom name" value={groom} onChange={(e) => setGroom(e.target.value)} />
            <input type="date" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" required value={date} onChange={(e) => setDate(e.target.value)} />
            <textarea className="sm:col-span-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            {err && <div className="sm:col-span-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
            <div className="sm:col-span-3 flex gap-2">
              <button type="submit" disabled={busy} className="flex-1 rounded-md bg-[var(--charcoal)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50">
                {busy ? "Creating…" : "Create Project"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--cream)]">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {isLoading ? (
            <div className="text-sm text-[var(--charcoal)]/60">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="sm:col-span-2 rounded-lg border border-dashed border-[var(--champagne)] bg-white py-16 text-center">
              <p className="text-sm text-[var(--charcoal)]/60">No projects yet. Create one to get started.</p>
            </div>
          ) : (
            projects.map((p: any) => (
              <Link
                key={p.id}
                to="/admin/projects/$id"
                params={{ id: p.id }}
                className="rounded-lg border border-[var(--border)] bg-white p-4 hover:border-[var(--terracotta)]"
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--charcoal)]/55">
                  <Heart className="h-3 w-3" /> Wedding
                </div>
                <h3 className="mt-1 font-display text-xl text-[var(--charcoal)]">
                  {p.bride_name} <span className="text-[var(--terracotta)]">&amp;</span> {p.groom_name}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--charcoal)]/65">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(p.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
