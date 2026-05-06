export interface QuoteSummary {
  count: number;
  latest_status: string | null;
  has_closed: boolean;
  closed_amount: number | null;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Returns a short human label like "1st Quote Received", "Closed", "Revised · 2nd Quote", or null when there are no quotes. */
export function quoteSummaryLabel(s: QuoteSummary | null | undefined): string | null {
  if (!s || s.count === 0) return null;
  if (s.has_closed) return "Closed";
  if (s.latest_status === "revised") return `Revised · ${ordinal(s.count)} Quote`;
  return `${ordinal(s.count)} Quote Received`;
}
