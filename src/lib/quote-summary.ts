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

function formatINRShort(amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

/** Returns a short human label like "1st Quote · ₹1,20,000", "Closed · ₹2,00,000", "Revised · 2nd Quote · ₹1,50,000", or null when there are no quotes. */
export function quoteSummaryLabel(s: QuoteSummary | null | undefined): string | null {
  if (!s || s.count === 0) return null;
  if (s.has_closed) {
    const amt = s.closed_amount ?? s.latest_amount;
    return amt != null ? `Closed · ${formatINRShort(Number(amt))}` : "Closed";
  }
  const amt = s.latest_amount;
  const base =
    s.latest_status === "revised"
      ? `Revised · ${ordinal(s.count)} Quote`
      : `${ordinal(s.count)} Quote Received`;
  return amt != null ? `${base} · ${formatINRShort(Number(amt))}` : base;
}
