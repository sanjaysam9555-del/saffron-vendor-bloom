export type QuoteStatus = "received" | "revised" | "closed" | "withdrawn";

export interface QuoteFile {
  id: string;
  quote_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface ProjectVendorQuote {
  id: string;
  project_id: string;
  vendor_id: string;
  category: string | null;
  quote_text: string | null;
  quote_amount: number | null;
  currency: string;
  status: QuoteStatus;
  is_final: boolean;
  closed_amount: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  files: QuoteFile[];
}

export interface VendorBookedSummary {
  vendor_id: string;
  times_booked: number;
  last_booked_at: string | null;
  last_closed_amount: number | null;
  last_project_id: string | null;
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  received: "Received",
  revised: "Revised",
  closed: "Closed",
  withdrawn: "Withdrawn",
};

export function formatINR(amount: number | null | undefined): string {
  if (amount == null) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatINRShort(amount: number | null | undefined): string {
  if (amount == null) return "";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const trim = (n: number, d: number) =>
    n.toFixed(d).replace(/\.?0+$/, "");
  if (abs >= 1_00_00_000) return `₹${sign}${trim(abs / 1_00_00_000, 2)}Cr`;
  if (abs >= 1_00_000) return `₹${sign}${trim(abs / 1_00_000, 2)}L`;
  if (abs >= 1_000) return `₹${sign}${Math.round(abs / 1_000)}K`;
  return formatINR(amount);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function buildQuoteSeqMap<T extends { id: string; created_at: string }>(
  quotes: T[],
): Record<string, number> {
  const sorted = [...quotes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const map: Record<string, number> = {};
  sorted.forEach((q, i) => {
    map[q.id] = i + 1;
  });
  return map;
}
