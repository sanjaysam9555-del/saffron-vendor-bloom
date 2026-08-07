import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, LayoutGrid, Rows3, Search, CheckSquare } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import {
  listAllTasks,
  listGlobalTaskFormOptions,
  updateProjectTask,
  type ProjectTask,
  type TaskStage,
  type TaskVendorOption,
} from "@/lib/project-tasks.functions";
import { notifyError } from "@/lib/ui/feedback";
import { TaskCard } from "@/components/admin/project-tabs/tasks/TaskCard";
import { TaskBoard } from "@/components/admin/project-tabs/tasks/TaskBoard";
import { TaskTable } from "@/components/admin/project-tabs/tasks/TaskTable";
import { PRIORITY_ORDER, STAGE_LABEL, STAGE_ORDER } from "@/components/admin/project-tabs/tasks/task-meta";

export const Route = createFileRoute("/admin/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Saffron Planning Studio" },
      { name: "description", content: "Every task across every wedding, in one place." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin={false}>
      <SystemTasksPage />
    </AuthGate>
  ),
});

type TaskWithProject = ProjectTask & { project_label: string };

function SystemTasksPage() {
  const qc = useQueryClient();
  const key = ["all-tasks"];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listAllTasks(),
  });

  const { data: globalOptions } = useQuery({
    queryKey: ["global-task-form-options"],
    queryFn: () => listGlobalTaskFormOptions(),
  });

  const [view, setView] = useState<"board" | "table">("board");
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<TaskWithProject | null>(null);
  const [q, setQ] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<TaskStage | "">("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [doneFilter, setDoneFilter] = useState<"" | "show" | "hide">("");
  const hideDone = doneFilter === "hide";

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const setStage = useMutation({
    mutationFn: (input: { id: string; stage: TaskStage }) => updateProjectTask({ data: input }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskWithProject[]>(key);
      qc.setQueryData<TaskWithProject[]>(key, (old) =>
        old?.map((t) => (t.id === id ? { ...t, stage, done: stage === "done" } : t)),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      notifyError(e, "Could not update stage");
    },
    onSettled: invalidate,
  });

  // The project filter is a scope, not just another narrowing filter — the
  // category-autocomplete list below reacts to it too.
  const scoped = useMemo(
    () => (projectFilter ? tasks.filter((t) => t.project_id === projectFilter) : tasks),
    [tasks, projectFilter],
  );

  const taskCategories = useMemo(
    () => Array.from(new Set(scoped.map((t) => t.task_category).filter(Boolean) as string[])).sort(),
    [scoped],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped.filter((t) => {
      if (hideDone && t.stage === "done") return false;
      if (stageFilter && t.stage !== stageFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assignee_user_id !== assigneeFilter) return false;
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        t.project_label.toLowerCase().includes(needle) ||
        (t.task_category ?? "").toLowerCase().includes(needle) ||
        (t.remarks ?? "").toLowerCase().includes(needle) ||
        t.vendors.some((v) => v.vendor_name.toLowerCase().includes(needle))
      );
    });
  }, [scoped, q, stageFilter, priorityFilter, assigneeFilter, hideDone]);

  const selectCls =
    "rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-xs text-[var(--charcoal)] focus:border-[var(--terracotta)] focus:outline-none";

  const composerOptions = {
    vendors: [] as TaskVendorOption[],
    staff: globalOptions?.staff ?? [],
    projects: globalOptions?.projects ?? [],
  };

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      {/* Secondary toolbar */}
      <div className="h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 h-full px-3 sm:gap-4 sm:px-6">
          <div className="relative min-w-0 flex-1 sm:max-w-[320px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--charcoal)]/55" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks, projects, vendors…"
              className="w-full rounded-md border border-[var(--border)] bg-white py-1.5 pl-8 pr-3 text-sm text-[var(--charcoal)] placeholder:text-[var(--charcoal)]/58 focus:border-[var(--terracotta)] focus:outline-none focus:ring-2 focus:ring-[var(--terracotta-soft)]"
            />
          </div>

          <button
            onClick={() => {
              setEditing(null);
              setComposing(true);
            }}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-2.5 py-1.5 text-sm font-medium text-[var(--cream)] shadow-sm transition-all hover:bg-[var(--terracotta)]/90 hover:-translate-y-0.5 sm:px-3.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New task</span>
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 hidden sm:mb-5 sm:block">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Tasks
          </h1>
        </div>

        <div className="space-y-4">
          {/* ── Filters ──
              Mobile: a tidy 2-col grid holding every filter and the view
              toggle (6 cells, 3 even rows). sm+: `contents` drops the
              grouping wrapper so every control becomes a direct child of
              the single flex-wrap row below, inline as one row. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={`${selectCls} w-full sm:w-auto`}>
                <option value="">Project</option>
                {(globalOptions?.projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>

              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as TaskStage | "")} className={`${selectCls} w-full sm:w-auto`}>
                <option value="">Stage</option>
                {STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>

              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={`${selectCls} w-full sm:w-auto`}>
                <option value="">Priority</option>
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={`${selectCls} w-full sm:w-auto`}>
                <option value="">Assignee</option>
                {(globalOptions?.staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={doneFilter}
                onChange={(e) => setDoneFilter(e.target.value as "" | "show" | "hide")}
                className={`${selectCls} w-full sm:w-auto`}
              >
                <option value="">Tasks</option>
                <option value="show">Show Done</option>
                <option value="hide">Hide Done</option>
              </select>

              <div className="flex w-full overflow-hidden rounded-md border border-[var(--border)] sm:w-auto sm:ml-auto">
                {(["board", "table"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`inline-flex flex-1 items-center justify-center gap-1 px-2.5 py-1.5 text-xs transition sm:flex-initial ${
                      view === v ? "bg-[var(--charcoal)] text-[var(--cream)]" : "bg-white text-[var(--charcoal)]/74"
                    }`}
                  >
                    {v === "board" ? <LayoutGrid className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
                    {v === "board" ? "Board" : "Table"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Composer / editor ── */}
          {(composing || editing) && globalOptions && (
            <TaskCard
              projectId={editing ? editing.project_id : projectFilter || undefined}
              options={composerOptions}
              tasks={tasks}
              task={editing}
              taskCategories={taskCategories}
              onClose={() => {
                setComposing(false);
                setEditing(null);
              }}
            />
          )}

          {/* ── Views ── */}
          {isLoading ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-10 text-center text-sm text-[var(--charcoal)]/66">
              Loading tasks…
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-10 text-center">
              <CheckSquare className="mx-auto h-6 w-6 text-[var(--charcoal)]/50" />
              <p className="mt-2 text-sm text-[var(--charcoal)]/70">No tasks yet across any project.</p>
              <button
                onClick={() => setComposing(true)}
                className="mt-3 inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)]"
              >
                <Plus className="h-3.5 w-3.5" /> Create the first task
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-white py-10 text-center text-sm text-[var(--charcoal)]/66">
              No tasks match this view.
            </div>
          ) : view === "board" ? (
            <TaskBoard
              tasks={filtered}
              onOpen={(t) => {
                setComposing(false);
                setEditing(t as TaskWithProject);
              }}
              onStageChange={(id, stage) => setStage.mutate({ id, stage })}
            />
          ) : (
            <TaskTable
              tasks={filtered}
              showProject
              onOpen={(t) => {
                setComposing(false);
                setEditing(t as TaskWithProject);
              }}
              onStageChange={(id, stage) => setStage.mutate({ id, stage })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
