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
