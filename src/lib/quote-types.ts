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
