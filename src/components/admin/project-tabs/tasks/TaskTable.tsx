import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import type { ProjectTask, TaskStage } from "@/lib/project-tasks.functions";
import { PriorityChip, STAGE_LABEL, STAGE_ORDER, StagePill, formatDue, isOverdue } from "./task-meta";

type SortKey = "title" | "priority" | "due_date" | "stage" | "assignee";

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function TaskTable({
  tasks,
  onOpen,
  onStageChange,
}: {
  tasks: ProjectTask[];
  onOpen: (task: ProjectTask) => void;
  onStageChange: (id: string, stage: TaskStage) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "priority", dir: "asc" });

  const sorted = useMemo(() => {
    const val = (t: ProjectTask) => {
      switch (sort.key) {
        case "title":
          return t.title.toLowerCase();
        case "priority":
          return PRIORITY_RANK[t.priority] ?? 9;
        case "due_date":
          return t.due_date ?? "9999-12-31";
        case "stage":
          return STAGE_ORDER.indexOf(t.stage);
        case "assignee":
          return (t.assignee_name ?? "zzz").toLowerCase();
      }
    };
    return [...tasks].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (sort.dir === "asc" ? 1 : -1);
    });
  }, [tasks, sort]);

  const Th = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2.5 ${className}`}>
      <button
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" }))}
        className="inline-flex items-center gap-1 transition hover:text-[var(--cream)]"
      >
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sort.key === k ? "opacity-100" : "opacity-35"}`} />
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
          <tr>
            <Th k="priority" className="w-14">P</Th>
            <Th k="title">Task</Th>
            <th className="px-3 py-2.5">Category</th>
            <th className="px-3 py-2.5">Vendors</th>
            <Th k="assignee">Assignee</Th>
            <Th k="due_date">Due</Th>
            <Th k="stage">Stage</Th>
          </tr>
        </thead>
        <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--charcoal)]/45">
                No tasks match this view.
              </td>
            </tr>
          ) : (
            sorted.map((t) => (
              <tr
                key={t.id}
                className={`border-t border-[var(--border)] transition hover:bg-[var(--cream)]/60 ${
                  t.stage === "done" ? "bg-emerald-500/10" : ""
                }`}
              >
                <td className="px-3 py-2.5">
                  <PriorityChip priority={t.priority} />
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => onOpen(t)}
                    className={`text-left font-medium transition hover:text-[var(--terracotta)] ${
                      t.stage === "done" ? "text-[var(--charcoal)]/45" : "text-[var(--charcoal)]"
                    }`}
                  >
                    {t.title}
                  </button>
                  {t.remarks && (
                    <div className="mt-0.5 line-clamp-1 text-[11px] text-[var(--charcoal)]/50">{t.remarks}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-[var(--charcoal)]/70">{t.task_category || "—"}</td>
                <td className="max-w-[200px] px-3 py-2.5 text-xs text-[var(--charcoal)]/70">
                  {t.vendors.length === 0 ? "—" : <span className="line-clamp-1">{t.vendors.map((v) => v.vendor_name).join(", ")}</span>}
                </td>
                <td className="px-3 py-2.5 text-xs text-[var(--charcoal)]/70">{t.assignee_name || "—"}</td>
                <td
                  className={`px-3 py-2.5 text-xs ${
                    isOverdue(t.due_date, t.stage) ? "font-semibold text-[var(--terracotta)]" : "text-[var(--charcoal)]/70"
                  }`}
                >
                  {formatDue(t.due_date)}
                </td>
                <td className="px-3 py-2.5">
                  <select
                    value={t.stage}
                    onChange={(e) => onStageChange(t.id, e.target.value as TaskStage)}
                    className="max-w-[150px] rounded-md border border-[var(--border)] bg-white px-1.5 py-1 text-[11px] focus:border-[var(--terracotta)] focus:outline-none"
                  >
                    {STAGE_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="hidden">
        <StagePill stage="done" />
      </div>
    </div>
  );
}
