import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, Check, X, Loader2, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  listTaskFormOptions,
  type ProjectTask,
  type TaskPriority,
  type TaskStage,
  type TaskStaffOption,
  type TaskVendorOption,
} from "@/lib/project-tasks.functions";
import { notifyError } from "@/lib/ui/feedback";
import {
  PRIORITY_ORDER,
  QUOTE_STATUS_LABEL,
  STAGE_LABEL,
  STAGE_ORDER,
  formatDue,
} from "./task-meta";

interface Options {
  vendors: TaskVendorOption[];
  staff: TaskStaffOption[];
  projects: { id: string; label: string; wedding_date: string }[];
}

const fieldCls =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--charcoal)] transition focus:border-[var(--terracotta)] focus:outline-none focus:ring-2 focus:ring-[var(--terracotta)]/15";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/50">
      {children}
    </span>
  );
}

function SectionHeading({ index, title, hint }: { index: string; title: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--terracotta-soft)] text-[10px] font-bold text-[var(--terracotta)]">
        {index}
      </span>
      <h4 className="font-display text-base text-[var(--charcoal)]">{title}</h4>
      <span className="text-[11px] text-[var(--charcoal)]/45">{hint}</span>
    </div>
  );
}

export function TaskCard({
  projectId,
  options,
  tasks,
  task,
  taskCategories,
  onClose,
}: {
  /** Pre-fills and (when editing) locks the project. Omit/empty for the
   * system-wide Tasks page, where the planner picks a project explicitly. */
  projectId?: string;
  options: Options;
  tasks: ProjectTask[];
  task?: ProjectTask | null;
  taskCategories: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [taskCategory, setTaskCategory] = useState(task?.task_category ?? "");
  const [remarks, setRemarks] = useState(task?.remarks ?? "");
  const [project, setProject] = useState(task?.project_id ?? projectId ?? "");
  const [vendorCategory, setVendorCategory] = useState(task?.vendor_category ?? "");
  const [vendorIds, setVendorIds] = useState<string[]>(task?.vendors.map((v) => v.vendor_id) ?? []);
  const [assignee, setAssignee] = useState(task?.assignee_user_id ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "P2");
  const [stage, setStage] = useState<TaskStage>(task?.stage ?? "not_picked");
  const [due, setDue] = useState<string>(task?.due_date ?? "");
  const [dueOpen, setDueOpen] = useState(false);
  const [preceding, setPreceding] = useState(task?.preceding_task_id ?? "");
  const [succeeding, setSucceeding] = useState(task?.succeeding_task_id ?? "");

  // Vendors are project-scoped, so they're refetched whenever the selected
  // project changes rather than trusted from the (possibly stale, possibly
  // empty — the system-wide page has none up front) `options` prop. When the
  // project matches what the parent already fetched, this hits cache and
  // resolves instantly.
  const vendorOptionsQuery = useQuery({
    queryKey: ["task-form-options", project],
    queryFn: () => listTaskFormOptions({ data: { project_id: project } }),
    enabled: !!project,
  });
  const vendorOptions = project ? (vendorOptionsQuery.data?.vendors ?? options.vendors) : [];

  const vendorCategories = useMemo(
    () => Array.from(new Set(vendorOptions.map((v) => v.category).filter(Boolean) as string[])).sort(),
    [vendorOptions],
  );

  const visibleVendors = useMemo(
    () => (vendorCategory ? vendorOptions.filter((v) => v.category === vendorCategory) : vendorOptions),
    [vendorOptions, vendorCategory],
  );

  // Drop selections that no longer belong to the chosen category, or that
  // don't belong to the project at all (e.g. project was just switched).
  useEffect(() => {
    setVendorIds((ids) =>
      ids.filter((id) => (vendorCategory ? visibleVendors : vendorOptions).some((v) => v.id === id)),
    );
  }, [project, vendorCategory, visibleVendors, vendorOptions]);

  const selectedVendors = vendorOptions.filter((v) => vendorIds.includes(v.id));
  // Dependencies only make sense within the same project.
  const dependencyPool = tasks.filter((t) => t.id !== task?.id && t.project_id === project);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    if (project !== projectId) qc.invalidateQueries({ queryKey: ["project-tasks", project] });
  };

  const payload = () => ({
    title: title.trim(),
    task_category: taskCategory.trim() || null,
    vendor_category: vendorCategory || null,
    remarks: remarks.trim() || null,
    assignee_user_id: assignee || null,
    due_date: due || null,
    priority,
    stage,
    preceding_task_id: preceding || null,
    succeeding_task_id: succeeding || null,
    vendor_ids: vendorIds,
  });

  const save = useMutation({
    mutationFn: async () =>
      editing
        ? updateProjectTask({ data: { id: task!.id, ...payload() } })
        : createProjectTask({ data: { project_id: project, ...payload() } }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => notifyError(e, editing ? "Could not save task" : "Could not add task"),
  });

  const remove = useMutation({
    mutationFn: () => deleteProjectTask({ data: { id: task!.id } }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => notifyError(e, "Could not delete task"),
  });

  const dueDateObj = due ? new Date(`${due}T00:00:00`) : undefined;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !project) return;
        save.mutate();
      }}
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)]"
    >
      {/* ── Title bar ── */}
      <div className="border-b border-[var(--border)] bg-[var(--cream)]/45 px-5 py-4">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to happen?"
          className="w-full bg-transparent font-display text-xl text-[var(--charcoal)] placeholder:text-[var(--charcoal)]/30 focus:outline-none"
        />
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-3">
        {/* ── 1. What ── */}
        <section className="space-y-3">
          <SectionHeading index="1" title="What" hint="the ask" />
          <label className="block">
            <Label>Task category</Label>
            <input
              list="task-category-options"
              value={taskCategory}
              onChange={(e) => setTaskCategory(e.target.value)}
              placeholder="e.g. Vendor coordination"
              className={fieldCls}
            />
            <datalist id="task-category-options">
              {taskCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <Label>Remarks</Label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              placeholder="Context, links, what good looks like…"
              className={`${fieldCls} resize-none`}
            />
          </label>
        </section>

        {/* ── 2. Who ── */}
        <section className="space-y-3">
          <SectionHeading index="2" title="Who" hint="project, vendors, owner" />
          <label className="block">
            <Label>Project</Label>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              disabled={editing}
              className={`${fieldCls} disabled:opacity-70`}
            >
              {!project && <option value="">Select a project…</option>}
              {options.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <Label>Vendor category</Label>
            <select
              value={vendorCategory}
              onChange={(e) => setVendorCategory(e.target.value)}
              disabled={!project}
              className={`${fieldCls} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="">All categories</option>
              {vendorCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div>
            <Label>Vendors</Label>
            {!project ? (
              <p className="text-xs text-[var(--charcoal)]/45">Select a project first.</p>
            ) : visibleVendors.length === 0 ? (
              <p className="text-xs text-[var(--charcoal)]/45">No vendors assigned in this category.</p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5">
                {visibleVendors.map((v) => {
                  const on = vendorIds.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        setVendorIds((ids) => (on ? ids.filter((i) => i !== v.id) : [...ids, v.id]))
                      }
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                        on ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)]" : "hover:bg-[var(--cream)]/70"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                            on ? "border-[var(--terracotta)] bg-[var(--terracotta)]" : "border-[var(--border)]"
                          }`}
                        >
                          {on && <Check className="h-2.5 w-2.5 text-[var(--cream)]" />}
                        </span>
                        <span className="truncate">{v.vendor_name}</span>
                      </span>
                      {v.quote_status && (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                            v.quote_status === "closed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-[var(--cream-deep)] text-[var(--charcoal)]/65"
                          }`}
                        >
                          {QUOTE_STATUS_LABEL[v.quote_status] ?? v.quote_status}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedVendors.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selectedVendors.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] text-[var(--charcoal)]/75"
                  >
                    {v.vendor_name}
                    <button type="button" onClick={() => setVendorIds((ids) => ids.filter((i) => i !== v.id))}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <label className="block">
            <Label>Assignee</Label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={fieldCls}>
              <option value="">Unassigned</option>
              {options.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* ── 3. When ── */}
        <section className="space-y-3">
          <SectionHeading index="3" title="When" hint="priority, stage, sequence" />
          <div>
            <Label>Priority</Label>
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-[var(--border)] p-1">
              {PRIORITY_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`rounded-md py-1.5 text-xs font-bold transition ${
                    priority === p
                      ? p === "P0"
                        ? "bg-[var(--terracotta)] text-[var(--cream)]"
                        : "bg-[var(--charcoal)] text-[var(--cream)]"
                      : "text-[var(--charcoal)]/55 hover:bg-[var(--cream)]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Deadline</Label>
            <Popover open={dueOpen} onOpenChange={setDueOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={`${fieldCls} flex items-center justify-between text-left`}>
                  <span className={due ? "" : "text-[var(--charcoal)]/40"}>{due ? formatDue(due) : "Pick a date"}</span>
                  <CalendarIcon className="h-3.5 w-3.5 text-[var(--charcoal)]/45" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDateObj}
                  onSelect={(d) => {
                    if (d) {
                      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                      setDue(iso);
                    } else setDue("");
                    setDueOpen(false);
                  }}
                  initialFocus
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
            {due && (
              <button
                type="button"
                onClick={() => setDue("")}
                className="mt-1 text-[10px] text-[var(--charcoal)]/45 hover:text-[var(--terracotta)]"
              >
                Clear date
              </button>
            )}
          </div>

          <label className="block">
            <Label>Stage</Label>
            <select value={stage} onChange={(e) => setStage(e.target.value as TaskStage)} className={fieldCls}>
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <Label>Preceded by</Label>
              <select value={preceding} onChange={(e) => setPreceding(e.target.value)} className={fieldCls}>
                <option value="">None</option>
                {dependencyPool.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <Label>Followed by</Label>
              <select value={succeeding} onChange={(e) => setSucceeding(e.target.value)} className={fieldCls}>
                <option value="">None</option>
                {dependencyPool.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--cream)]/35 px-5 py-3">
        <div>
          {editing && (
            <button
              type="button"
              onClick={() => remove.mutate()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-[var(--charcoal)]/50 transition hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-[var(--charcoal)]/60 transition hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !project || save.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-4 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editing ? "Save task" : "Create task"}
          </button>
        </div>
      </div>
    </form>
  );
}
