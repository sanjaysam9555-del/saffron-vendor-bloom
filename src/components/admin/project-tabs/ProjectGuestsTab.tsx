import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import {
  listProjectGuests,
  createProjectGuest,
  updateProjectGuest,
  deleteProjectGuest,
  type RsvpStatus,
} from "@/lib/project-guests.functions";
import { notifyError } from "@/lib/ui/feedback";

const RSVP_META: Record<RsvpStatus, { label: string; cls: string }> = {
  yes: { label: "Yes", cls: "bg-emerald-100 text-emerald-800" },
  no: { label: "No", cls: "bg-rose-100 text-rose-700" },
  maybe: { label: "Maybe", cls: "bg-[var(--gold-soft)] text-[hsl(38_45%_28%)]" },
  pending: { label: "Pending", cls: "bg-[var(--cream-deep)] text-[var(--charcoal)]/70" },
};
const RSVP_ORDER: RsvpStatus[] = ["yes", "no", "maybe", "pending"];

export function ProjectGuestsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ["project-guests", projectId];
  const { data: guests = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listProjectGuests({ data: { project_id: projectId } }),
  });

  const [filter, setFilter] = useState<"all" | RsvpStatus>("all");
  const [name, setName] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: () => createProjectGuest({ data: { project_id: projectId, name: name.trim() } }),
    onSuccess: () => {
      setName("");
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not add guest"),
  });

  const patch = useMutation({
    mutationFn: (input: { id: string } & Partial<{ rsvp_status: RsvpStatus }>) => updateProjectGuest({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<typeof guests>(key);
      qc.setQueryData<typeof guests>(key, (old) => old?.map((g) => (g.id === input.id ? { ...g, ...input } : g)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      notifyError(e, "Could not update RSVP");
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProjectGuest({ data: { id } }),
    onSuccess: invalidate,
    onError: (e) => notifyError(e, "Could not remove guest"),
  });

  const counts = useMemo(() => {
    const c: Record<RsvpStatus, number> = { yes: 0, no: 0, maybe: 0, pending: 0 };
    for (const g of guests) c[g.rsvp_status]++;
    return c;
  }, [guests]);

  const filtered = filter === "all" ? guests : guests.filter((g) => g.rsvp_status === filter);

  return (
    <div className="space-y-4">
      {/* ── Filter row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-white text-xs">
          {(["all", ...RSVP_ORDER] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-medium capitalize transition ${
                filter === f
                  ? "bg-[var(--terracotta)] text-[var(--cream)]"
                  : "text-[var(--charcoal)]/78 hover:bg-[var(--cream)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--charcoal)]/70">
          {RSVP_ORDER.map((s) => (
            <span key={s}>
              {RSVP_META[s].label} · <span className="font-medium text-[var(--charcoal)]">{counts[s]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Quick add ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate();
        }}
        className="flex items-center gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a guest by name…"
          className="w-64 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm focus:border-[var(--terracotta)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!name.trim() || create.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </form>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Side</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5 text-center">+1</th>
                <th className="px-4 py-2.5">Meal</th>
                <th className="px-4 py-2.5">RSVP</th>
                <th className="w-10 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--charcoal)]/66">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--charcoal)]/62">No guests here.</td></tr>
              ) : (
                filtered.map((g) => (
                  <tr key={g.id} className="border-t border-[var(--border)] group">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-[var(--charcoal)]">{g.name}</div>
                      {g.phone && <div className="text-[11px] text-[var(--charcoal)]/62">{g.phone}</div>}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-[var(--charcoal)]/82">{g.side || "—"}</td>
                    <td className="px-4 py-2.5 text-[var(--charcoal)]/82">{g.category || "—"}</td>
                    <td className="px-4 py-2.5 text-center text-[var(--charcoal)]/82">{g.plus_one}</td>
                    <td className="px-4 py-2.5 text-[var(--charcoal)]/82">{g.meal || "—"}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={g.rsvp_status}
                        onChange={(e) => patch.mutate({ id: g.id, rsvp_status: e.target.value as RsvpStatus })}
                        className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-medium capitalize ${RSVP_META[g.rsvp_status].cls}`}
                      >
                        {RSVP_ORDER.map((s) => (
                          <option key={s} value={s}>{RSVP_META[s].label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => remove.mutate(g.id)}
                        title="Remove guest"
                        className="rounded p-1 text-[var(--charcoal)]/52 opacity-0 transition hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)] group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
