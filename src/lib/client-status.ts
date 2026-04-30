export type ClientVendorStatus =
  | "like"
  | "shortlisted"
  | "finalised"
  | "rejected"
  | "thinking";

export interface ClientStatusOption {
  value: ClientVendorStatus;
  label: string;
  /** Tailwind classes for a small pill / badge representation */
  pill: string;
  /** Solid dot color (CSS) for select indicators */
  dot: string;
}

export const CLIENT_STATUS_OPTIONS: ClientStatusOption[] = [
  {
    value: "like",
    label: "We like it",
    pill: "bg-[var(--terracotta-soft)] text-[var(--terracotta)]",
    dot: "var(--terracotta)",
  },
  {
    value: "shortlisted",
    label: "Shortlisted",
    pill: "bg-amber-100 text-amber-800",
    dot: "#b45309",
  },
  {
    value: "finalised",
    label: "Finalised",
    pill: "bg-emerald-100 text-emerald-800",
    dot: "#047857",
  },
  {
    value: "rejected",
    label: "Rejected",
    pill: "bg-rose-100 text-rose-700",
    dot: "#be123c",
  },
  {
    value: "thinking",
    label: "Need to think about it",
    pill: "bg-slate-200 text-slate-700",
    dot: "#475569",
  },
];

export function getClientStatusOption(
  status: ClientVendorStatus | null | undefined,
): ClientStatusOption | null {
  if (!status) return null;
  return CLIENT_STATUS_OPTIONS.find((o) => o.value === status) ?? null;
}
