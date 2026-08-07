import type { TaskPriority, TaskStage } from "@/lib/project-tasks.functions";

export const PRIORITY_ORDER: TaskPriority[] = ["P0", "P1", "P2", "P3"];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  P0: "P0 · Critical",
  P1: "P1 · High",
  P2: "P2 · Normal",
  P3: "P3 · Low",
};

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  P0: "bg-[var(--terracotta)] text-[var(--cream)]",
  P1: "bg-[var(--terracotta-soft)] text-[var(--terracotta)]",
  P2: "bg-[var(--gold-soft)] text-[hsl(38_45%_28%)]",
  P3: "bg-[var(--cream-deep)] text-[var(--charcoal)]/70",
};

export const STAGE_ORDER: TaskStage[] = [
  "not_picked",
  "in_progress",
  "pending_client",
  "pending_vendor",
  "pending_planner",
  "held_up",
  "done",
];

export const STAGE_LABEL: Record<TaskStage, string> = {
  not_picked: "Not yet picked up",
  in_progress: "In progress",
  pending_client: "Pending on client",
  pending_vendor: "Pending on vendor",
  pending_planner: "Pending on planner",
  held_up: "Held up",
  done: "Done",
};

const STAGE_CLASS: Record<TaskStage, string> = {
  not_picked: "bg-[var(--cream-deep)] text-[var(--charcoal)]/74",
  in_progress: "bg-sky-100 text-sky-800",
  pending_client: "bg-violet-100 text-violet-800",
  pending_vendor: "bg-amber-100 text-amber-900",
  pending_planner: "bg-[var(--gold-soft)] text-[hsl(38_45%_28%)]",
  held_up: "bg-rose-100 text-rose-800",
  done: "bg-emerald-100 text-emerald-800",
};

export const STAGE_ACCENT: Record<TaskStage, string> = {
  not_picked: "bg-[var(--charcoal)]/25",
  in_progress: "bg-sky-500",
  pending_client: "bg-violet-500",
  pending_vendor: "bg-amber-500",
  pending_planner: "bg-[var(--gold)]",
  held_up: "bg-rose-500",
  done: "bg-emerald-500",
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  received: "Quote received",
  revised: "Quote revised",
  closed: "Quote closed",
  withdrawn: "Quote withdrawn",
};

export function PriorityChip({ priority, className = "" }: { priority: TaskPriority; className?: string }) {
  return (
    <span
      title={PRIORITY_LABEL[priority]}
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${PRIORITY_CLASS[priority]} ${className}`}
    >
      {priority}
    </span>
  );
}

export function StagePill({ stage, className = "" }: { stage: TaskStage; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STAGE_CLASS[stage]} ${className}`}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function formatDue(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function isOverdue(d: string | null, stage: TaskStage) {
  if (!d || stage === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).getTime() < today.getTime();
}

export function initialsOf(name: string | null) {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
