import { AnimatePresence, motion } from "motion/react";
import { CLIENT_STATUS_OPTIONS, getClientStatusOption, type ClientVendorStatus } from "@/lib/client-status";

export function ClientStatusPill({ status, size = "sm" }: { status: ClientVendorStatus | string | null | undefined; size?: "xs" | "sm" }) {
  const opt = getClientStatusOption(status as ClientVendorStatus | null);
  const sizeCls = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  const key = opt?.value ?? "none";

  return (
    <span className="relative inline-flex">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={key}
          initial={{ opacity: 0, scale: 0.85, y: -2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 2 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
          className={
            opt
              ? `inline-flex items-center rounded-full font-medium ${opt.pill} ${sizeCls}`
              : `inline-flex items-center rounded-full bg-[var(--cream)] text-[var(--charcoal)]/70 ${sizeCls}`
          }
        >
          {opt ? opt.label : "No response"}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function StatusCountsRow({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CLIENT_STATUS_OPTIONS.map((opt) => (
        <span key={opt.value} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${opt.pill}`}>
          <span className="tabular-nums">{counts[opt.value] ?? 0}</span> {opt.label}
        </span>
      ))}
    </div>
  );
}

export { CLIENT_STATUS_OPTIONS };
