export interface QuoteSummary {
  count: number;
  latest_status: string | null;
  latest_amount?: number | null;
  has_closed: boolean;
  closed_amount: number | null;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatINRCompact(amount: number): string {
  const n = Math.abs(Number(amount));
  const trim = (v: number, d: number) =>
    v.toFixed(d).replace(/\.?0+$/, "");
  if (n >= 1_00_00_000) return `₹${trim(n / 1_00_00_000, 2)}Cr`;
  if (n >= 1_00_000) return `₹${trim(n / 1_00_000, 2)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}K`;
  return `₹${Math.round(n)}`;
}

/** Returns a short human label like "1st Quote · ₹2.96L", "Closed · ₹2L", "Revised · 2nd Quote · ₹1.5L", or null when there are no quotes. */
export function quoteSummaryLabel(s: QuoteSummary | null | undefined): string | null {
  if (!s || s.count === 0) return null;
  if (s.has_closed) {
    const amt = s.closed_amount ?? s.latest_amount;
    return amt != null ? `Closed · ${formatINRCompact(Number(amt))}` : "Closed";
  }
  const amt = s.latest_amount;
  const base =
    s.latest_status === "revised"
      ? `Revised · ${ordinal(s.count)} Quote`
      : `${ordinal(s.count)} Quote`;
  return amt != null ? `${base} · ${formatINRCompact(Number(amt))}` : base;
}
