import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { ClientStatusOption } from "@/lib/client-status";
import { FlipNumber } from "@/components/motion/FlipNumber";

interface Props {
  id: string;
  option: ClientStatusOption | null; // null = "No status"
  count: number;
  children: ReactNode;
}

export function ClientBoardColumn({ id, option, count, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const headerClass = option
    ? option.pill
    : "bg-[var(--cream-deep)] text-[var(--charcoal)]/75";

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-[var(--cream)]/50 transition-[border-color,background-color,transform,box-shadow] duration-200 ease-out ${
        isOver
          ? "scale-[1.01] border-[var(--terracotta)] bg-[var(--terracotta-soft)]/40 shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--terracotta)_55%,transparent)]"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          {option && (
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: option.dot }}
            />
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${headerClass}`}>
            {option?.label ?? "No status"}
          </span>
        </div>
        <span className="text-xs font-medium text-[var(--charcoal)]/55">
          <FlipNumber value={count} duration={0.45} />
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">{children}</div>
    </div>
  );
}
