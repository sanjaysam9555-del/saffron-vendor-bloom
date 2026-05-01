import { CLIENT_STATUS_OPTIONS, getClientStatusOption, type ClientVendorStatus } from "@/lib/client-status";

export function ClientStatusPill({ status, size = "sm" }: { status: ClientVendorStatus | string | null | undefined; size?: "xs" | "sm" }) {
  const opt = getClientStatusOption(status as ClientVendorStatus | null);
  if (!opt) {
    return (
      <span className={`inline-flex items-center rounded-full bg-[var(--cream)] text-[var(--charcoal)]/55 ${size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}>
        No response
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${opt.pill} ${size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}>
      {opt.label}
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
