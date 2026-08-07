import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, LayoutGrid, Rows3, Search } from "lucide-react";
import {
  listProjectTasks,
  listTaskFormOptions,
  updateProjectTask,
  type ProjectTask,
  type TaskStage,
} from "@/lib/project-tasks.functions";
import { notifyError } from "@/lib/ui/feedback";
import { TaskCard } from "./tasks/TaskCard";
import { TaskBoard } from "./tasks/TaskBoard";
import { TaskTable } from "./tasks/TaskTable";
import { PRIORITY_ORDER, STAGE_LABEL, STAGE_ORDER } from "./tasks/task-meta";

export function ProjectTasksTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ["project-tasks", projectId];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listProjectTasks({ data: { project_id: projectId } }),
  });

  const { data: options } = useQuery({
    queryKey: ["task-form-options", projectId],
    queryFn: () => listTaskFormOptions({ data: { project_id: projectId } }),
  });

  const [view, setView] = useState<"board" | "table">("board");
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<ProjectTask | null>(null);
  const [q, setQ] = useState("");
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
      const prev = qc.getQueryData<ProjectTask[]>(key);
      qc.setQueryData<ProjectTask[]>(key, (old) =>
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

  const taskCategories = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.task_category).filter(Boolean) as string[])).sort(),
    [tasks],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (hideDone && t.stage === "done") return false;
      if (stageFilter && t.stage !== stageFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assignee_user_id !== assigneeFilter) return false;
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        (t.task_category ?? "").toLowerCase().includes(needle) ||
        (t.remarks ?? "").toLowerCase().includes(needle) ||
        t.vendors.some((v) => v.vendor_name.toLowerCase().includes(needle))
      );
    });
  }, [tasks, q, stageFilter, priorityFilter, assigneeFilter, hideDone]);

  const selectCls =
    "rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-xs text-[var(--charcoal)] focus:border-[var(--terracotta)] focus:outline-none";

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──
          Mobile: search+New task stay paired on their own row, the four
          selects form a tidy 2×2 grid, and the view toggle gets its own
          full-width row. sm+: `contents` drops the select-grid wrapper so
          every control becomes a direct child of the flex-wrap row below,
          matching the original inline desktop layout exactly. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:min-w-[180px] sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--charcoal)]/55" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks, vendors, notes…"
            className="w-full rounded-md border border-[var(--border)] bg-white py-1.5 pl-8 pr-3 text-xs focus:border-[var(--terracotta)] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:contents">
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
            {(options?.staff ?? []).map((s) => (
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
        </div>

        <div className="flex w-full overflow-hidden rounded-md border border-[var(--border)] sm:w-auto">
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

        <button
          onClick={() => {
            setEditing(null);
            setComposing(true);
          }}
          className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90 sm:w-auto"
        >
          <Plus className="h-3.5 w-3.5" /> New task
        </button>
      </div>

      {/* ── Composer / editor ── */}
      {(composing || editing) && options && (
        <TaskCard
          projectId={projectId}
          options={options}
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
          <p className="text-sm text-[var(--charcoal)]/70">No tasks yet for this wedding.</p>
          <button
            onClick={() => setComposing(true)}
            className="mt-3 inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)]"
          >
            <Plus className="h-3.5 w-3.5" /> Create the first task
          </button>
        </div>
      ) : view === "board" ? (
        <TaskBoard
          tasks={filtered}
          onOpen={(t) => {
            setComposing(false);
            setEditing(t);
          }}
          onStageChange={(id, stage) => setStage.mutate({ id, stage })}
        />
      ) : (
        <TaskTable
          tasks={filtered}
          onOpen={(t) => {
            setComposing(false);
            setEditing(t);
          }}
          onStageChange={(id, stage) => setStage.mutate({ id, stage })}
        />
      )}
    </div>
  );
}
