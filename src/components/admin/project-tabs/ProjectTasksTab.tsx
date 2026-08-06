import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import {
  listProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  type TaskPriority,
} from "@/lib/project-tasks.functions";
import { notifyError } from "@/lib/ui/feedback";
import { PriorityPill } from "./ProjectOverviewTab";

export function ProjectTasksTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ["project-tasks", projectId];
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listProjectTasks({ data: { project_id: projectId } }),
  });

  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: () =>
      createProjectTask({
        data: { project_id: projectId, title: title.trim(), owner_name: owner.trim() || null, due_date: due || null, priority },
      }),
    onSuccess: () => {
      setTitle("");
      setOwner("");
      setDue("");
      setPriority("medium");
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not add task"),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => updateProjectTask({ data: input }),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<typeof tasks>(key);
      qc.setQueryData<typeof tasks>(key, (old) => old?.map((t) => (t.id === id ? { ...t, done } : t)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      notifyError(e, "Could not update task");
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProjectTask({ data: { id } }),
    onSuccess: invalidate,
    onError: (e) => notifyError(e, "Could not remove task"),
  });

  const fmtDue = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  return (
    <div className="space-y-4">
      {/* ── Quick add ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          create.mutate();
        }}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-3 shadow-sm"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="min-w-[160px] flex-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm focus:border-[var(--terracotta)] focus:outline-none"
        />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Owner"
          className="w-32 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm focus:border-[var(--terracotta)] focus:outline-none"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm focus:border-[var(--terracotta)] focus:outline-none"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm focus:border-[var(--terracotta)] focus:outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          type="submit"
          disabled={!title.trim() || create.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </form>

      {/* ── List ── */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
            <tr>
              <th className="w-8 px-4 py-2.5" />
              <th className="px-4 py-2.5">Task</th>
              <th className="px-4 py-2.5">Owner</th>
              <th className="px-4 py-2.5">Due</th>
              <th className="px-4 py-2.5">Priority</th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--charcoal)]/50">Loading…</td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--charcoal)]/45">No tasks yet.</td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id} className="border-t border-[var(--border)] group">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })}
                      className="h-4 w-4 rounded border-[var(--border)] accent-[var(--terracotta)]"
                      aria-label={`Mark ${t.title} ${t.done ? "not done" : "done"}`}
                    />
                  </td>
                  <td className={`px-4 py-2.5 ${t.done ? "text-[var(--charcoal)]/40 line-through" : "text-[var(--charcoal)]"}`}>
                    {t.title}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--charcoal)]/70">{t.owner_name || "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--charcoal)]/70">{fmtDue(t.due_date)}</td>
                  <td className="px-4 py-2.5"><PriorityPill priority={t.priority} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => remove.mutate(t.id)}
                      title="Delete task"
                      className="rounded p-1 text-[var(--charcoal)]/30 opacity-0 transition hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)] group-hover:opacity-100"
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
  );
}
