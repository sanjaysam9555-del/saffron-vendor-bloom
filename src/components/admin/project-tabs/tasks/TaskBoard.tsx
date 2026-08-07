import { useState } from "react";
import { Link2, CalendarClock, Users } from "lucide-react";
import type { ProjectTask, TaskStage } from "@/lib/project-tasks.functions";
import { PriorityChip, STAGE_ACCENT, STAGE_LABEL, STAGE_ORDER, formatDue, initialsOf, isOverdue } from "./task-meta";

export function TaskBoard({
  tasks,
  onOpen,
  onStageChange,
}: {
  tasks: (ProjectTask & { project_label?: string })[];
  onOpen: (task: ProjectTask) => void;
  onStageChange: (id: string, stage: TaskStage) => void;
}) {
  const [dragOver, setDragOver] = useState<TaskStage | null>(null);

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {STAGE_ORDER.map((stage) => {
        const items = tasks.filter((t) => t.stage === stage);
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(stage);
            }}
            onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) onStageChange(id, stage);
            }}
            className={`flex w-[248px] shrink-0 flex-col rounded-xl border transition ${
              dragOver === stage
                ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)]/40"
                : "border-[var(--border)] bg-[var(--cream)]/35"
            }`}
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${STAGE_ACCENT[stage]}`} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--charcoal)]/82">
                {STAGE_LABEL[stage]}
              </span>
              <span className="ml-auto rounded-full bg-white px-1.5 text-[10px] text-[var(--charcoal)]/70">
                {items.length}
              </span>
            </div>

            <div className="flex min-h-[80px] flex-col gap-2 p-2">
              {items.length === 0 ? (
                <p className="px-1 py-4 text-center text-[11px] text-[var(--charcoal)]/55">Nothing here</p>
              ) : (
                items.map((t) => {
                  const overdue = isOverdue(t.due_date, t.stage);
                  return (
                    <button
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                      onClick={() => onOpen(t)}
                      className="group rounded-lg border border-[var(--border)] bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-start gap-2">
                        <PriorityChip priority={t.priority} />
                        <span
                          className={`min-w-0 flex-1 text-sm leading-snug ${
                            t.stage === "done" ? "text-[var(--charcoal)]/62" : "text-[var(--charcoal)]"
                          }`}
                        >
                          {t.title}
                        </span>
                      </div>

                      {t.project_label && (
                        <div className="mt-1.5 truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--terracotta)]/80">
                          {t.project_label}
                        </div>
                      )}

                      {t.task_category && (
                        <div className="mt-1.5 inline-flex rounded bg-[var(--cream-deep)] px-1.5 py-0.5 text-[10px] text-[var(--charcoal)]/74">
                          {t.task_category}
                        </div>
                      )}

                      {t.vendors.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--charcoal)]/74">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">{t.vendors.map((v) => v.vendor_name).join(", ")}</span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--charcoal)]/70">
                        {t.due_date && (
                          <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-[var(--terracotta)]" : ""}`}>
                            <CalendarClock className="h-3 w-3" /> {formatDue(t.due_date)}
                          </span>
                        )}
                        {(t.preceding_task_id || t.succeeding_task_id) && <Link2 className="h-3 w-3" />}
                        <span
                          className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[var(--charcoal)] text-[9px] font-semibold text-[var(--cream)]"
                          title={t.assignee_name ?? "Unassigned"}
                        >
                          {initialsOf(t.assignee_name)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
