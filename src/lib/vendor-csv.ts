import Papa from "papaparse";
import type { VendorInput, Vendor } from "@/lib/vendor-types";

export interface VendorCsvField {
  key: keyof VendorInput;
  header: string;
  required: boolean;
  type: "text" | "number";
  example: string;
}

/** Column order doubles as the template/export column order. */
export const VENDOR_CSV_FIELDS: VendorCsvField[] = [
  { key: "vendor_name", header: "Vendor Name", required: true, type: "text", example: "Talabgoan Castle" },
  { key: "category", header: "Category", required: true, type: "text", example: "Hotels & Venues" },
  { key: "subcategory", header: "Subcategory", required: false, type: "text", example: "Heritage" },
  { key: "location", header: "Location", required: false, type: "text", example: "Jaipur" },
  { key: "contact_number", header: "Contact Number", required: false, type: "text", example: "9876543210" },
  { key: "email", header: "Email", required: false, type: "text", example: "hello@vendor.com" },
  { key: "instagram_handle", header: "Instagram Handle", required: false, type: "text", example: "talabgaon_castle" },
  { key: "website", header: "Website", required: false, type: "text", example: "https://vendor.com" },
  { key: "google_rating", header: "Google Rating", required: false, type: "number", example: "4.4" },
  { key: "saffron_rating", header: "Saffron Rating", required: false, type: "number", example: "4.5" },
  { key: "price_text", header: "Price", required: false, type: "text", example: "15L - 2 Days" },
  { key: "commission_model", header: "Commission Model", required: false, type: "text", example: "10% of billing" },
  { key: "portfolio_link", header: "Portfolio Link", required: false, type: "text", example: "https://vendor.com/portfolio" },
  { key: "source", header: "Source", required: false, type: "text", example: "Manual Entry" },
  { key: "remarks", header: "Remarks", required: false, type: "text", example: "Preferred for heritage weddings" },
  { key: "number_of_rooms", header: "Number of Rooms", required: false, type: "number", example: "45" },
  { key: "distance_from_delhi", header: "Distance from Delhi", required: false, type: "text", example: "280 km" },
  { key: "hotel_category", header: "Hotel Category", required: false, type: "text", example: "Luxury" },
  { key: "quote_breakdown", header: "Quote Breakdown", required: false, type: "text", example: "Venue + catering + stay" },
  { key: "team_size", header: "Team Size", required: false, type: "text", example: "12" },
  { key: "deliverables", header: "Deliverables", required: false, type: "text", example: "500 edited photos, 1 film" },
];

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_]+/g, " ");
}

/** Matches an incoming CSV header to a known field by display name or raw key name. */
const HEADER_LOOKUP: Map<string, VendorCsvField> = new Map(
  VENDOR_CSV_FIELDS.flatMap((f) => [
    [normalizeHeader(f.header), f],
    [normalizeHeader(f.key), f],
  ] as [string, VendorCsvField][]),
);

export function vendorsToCsv(vendors: Vendor[]): string {
  const header = VENDOR_CSV_FIELDS.map((f) => f.header);
  const rows = vendors.map((v) =>
    VENDOR_CSV_FIELDS.map((f) => {
      const value = v[f.key];
      return value == null ? "" : String(value);
    }),
  );
  return Papa.unparse({ fields: header, data: rows });
}

export function buildTemplateCsv(): string {
  const header = VENDOR_CSV_FIELDS.map((f) => f.header);
  const example = VENDOR_CSV_FIELDS.map((f) => f.example);
  return Papa.unparse({ fields: header, data: [example] });
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ParsedVendorRow {
  /** 1-based row number as it appears in the source file (header row is row 1). */
  rowNumber: number;
  input: VendorInput | null;
  errors: string[];
  isNewCategory: boolean;
}

export interface ParseVendorCsvResult {
  rows: ParsedVendorRow[];
  /** Columns present in the file we couldn't match to any known field — informational only, not fatal. */
  unrecognizedColumns: string[];
}

/**
 * Parses and validates a vendor CSV against VENDOR_CSV_FIELDS. Every row is
 * returned (valid or not) so the caller can show a full preview; only rows
 * with a non-null `input` are safe to import.
 */
export function parseVendorCsv(fileText: string, knownCategories: string[]): ParseVendorCsvResult {
  const parsed = Papa.parse<Record<string, string>>(fileText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h,
  });

  const sourceHeaders = parsed.meta.fields ?? [];
  const unrecognizedColumns = sourceHeaders.filter((h) => !HEADER_LOOKUP.has(normalizeHeader(h)));
  const knownLower = new Set(knownCategories.map((c) => c.toLowerCase()));

  const rows: ParsedVendorRow[] = parsed.data.map((raw, i) => {
    const errors: string[] = [];
    const draft: Record<string, unknown> = {};

    for (const field of VENDOR_CSV_FIELDS) {
      const sourceHeader = sourceHeaders.find((h) => normalizeHeader(h) === normalizeHeader(field.header) || normalizeHeader(h) === normalizeHeader(field.key));
      const rawValue = sourceHeader != null ? (raw[sourceHeader] ?? "").trim() : "";

      if (!rawValue) {
        if (field.required) errors.push(`${field.header} is required.`);
        draft[field.key] = null;
        continue;
      }

      if (field.type === "number") {
        const n = Number(rawValue);
        if (Number.isNaN(n)) {
          errors.push(`${field.header} must be a number (got "${rawValue}").`);
          draft[field.key] = null;
        } else {
          draft[field.key] = n;
        }
      } else {
        draft[field.key] = rawValue;
      }
    }

    const isNewCategory =
      typeof draft.category === "string" && draft.category.length > 0 && !knownLower.has((draft.category as string).toLowerCase());

    return {
      rowNumber: i + 2, // +1 for 1-based, +1 for header row
      input: errors.length === 0 ? (draft as VendorInput) : null,
      errors,
      isNewCategory,
    };
  });

  return { rows, unrecognizedColumns };
}
