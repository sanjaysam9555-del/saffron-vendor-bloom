import type { VendorInput } from "./vendor-types";
import { CATEGORIES } from "./categories";

const HEADER_MAP: Record<string, keyof VendorInput> = {
  // name
  "name": "vendor_name", "vendor": "vendor_name", "vendor name": "vendor_name", "vendorname": "vendor_name", "business": "vendor_name", "business name": "vendor_name",
  // category
  "category": "category", "type": "category", "service type": "category",
  // subcategory
  "subcategory": "subcategory", "sub category": "subcategory", "specialty": "subcategory", "specialization": "subcategory",
  // location
  "location": "location", "city": "location", "area": "location", "based in": "location",
  // contact
  "contact": "contact_number", "contact number": "contact_number", "phone": "contact_number", "mobile": "contact_number", "phone number": "contact_number", "whatsapp": "contact_number",
  // email
  "email": "email", "e-mail": "email", "mail": "email",
  // instagram
  "instagram": "instagram_handle", "ig": "instagram_handle", "insta": "instagram_handle", "instagram handle": "instagram_handle", "ig handle": "instagram_handle",
  // website
  "website": "website", "web": "website", "url": "website", "site": "website",
  // rating
  "rating": "google_rating", "google rating": "google_rating", "google reviews": "google_rating", "stars": "google_rating",
  // price
  "price low": "price_range_low", "min price": "price_range_low", "starting price": "price_range_low", "price from": "price_range_low", "budget low": "price_range_low",
  "price high": "price_range_high", "max price": "price_range_high", "price to": "price_range_high", "budget high": "price_range_high",
  // commission
  "commission": "commission_model", "commission model": "commission_model", "commission %": "commission_model",
  // portfolio
  "portfolio": "portfolio_link", "portfolio link": "portfolio_link", "work": "portfolio_link",
  // source
  "source": "source", "lead source": "source",
  // remarks
  "remarks": "remarks", "notes": "remarks", "comments": "remarks", "description": "remarks",
  // tags
  "tags": "tags", "labels": "tags",
  // hotel
  "rooms": "number_of_rooms", "number of rooms": "number_of_rooms", "no of rooms": "number_of_rooms",
  "distance": "distance_from_delhi", "distance from delhi": "distance_from_delhi",
  "hotel category": "hotel_category", "hotel type": "hotel_category", "category type": "hotel_category",
  // photo rfp
  "quote": "quote_breakdown", "quote breakdown": "quote_breakdown",
  "team size": "team_size", "team": "team_size",
  "deliverables": "deliverables", "delivery": "deliverables",
};

const NUMERIC_FIELDS = new Set<keyof VendorInput>([
  "google_rating", "price_range_low", "price_range_high", "number_of_rooms",
]);

export interface ParsedRow {
  data: Partial<VendorInput>;
  raw: Record<string, string>;
  errors: string[];
}

export interface ParseResult {
  headers: string[];
  mapping: Record<string, keyof VendorInput | null>;
  rows: ParsedRow[];
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

function findCategoryMatch(value: string): string | null {
  const v = value.trim().toLowerCase();
  for (const c of CATEGORIES) {
    if (c.toLowerCase() === v) return c;
    if (c.toLowerCase().startsWith(v.split(" ")[0])) return c;
    if (v.includes(c.toLowerCase().split(" ")[0])) return c;
  }
  return null;
}

function parseValue(field: keyof VendorInput, raw: string): { value: any; error?: string } {
  const v = raw?.trim();
  if (!v) return { value: null };

  if (field === "category") {
    const matched = findCategoryMatch(v);
    return matched ? { value: matched } : { value: v, error: `Unknown category "${v}"` };
  }
  if (field === "tags") {
    return { value: v.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) };
  }
  if (field === "instagram_handle") {
    return { value: v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "") };
  }
  if (NUMERIC_FIELDS.has(field)) {
    const cleaned = v.replace(/[₹,\s]/g, "").replace(/[lL]$/, "00000").replace(/[cC][rR]$/, "0000000").replace(/[kK]$/, "000");
    const n = parseFloat(cleaned);
    if (isNaN(n)) return { value: null, error: `Invalid number for ${field}: "${v}"` };
    return { value: n };
  }
  return { value: v };
}

export function buildMapping(headers: string[]): Record<string, keyof VendorInput | null> {
  const mapping: Record<string, keyof VendorInput | null> = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    mapping[h] = HEADER_MAP[norm] ?? null;
  }
  return mapping;
}

export function parseRows(
  headers: string[],
  rawRows: Record<string, string>[],
  mapping: Record<string, keyof VendorInput | null>,
): ParsedRow[] {
  return rawRows.map((row) => {
    const data: Partial<VendorInput> = {};
    const errors: string[] = [];
    for (const h of headers) {
      const field = mapping[h];
      if (!field) continue;
      const { value, error } = parseValue(field, row[h] ?? "");
      if (error) errors.push(error);
      if (value != null && value !== "") (data as any)[field] = value;
    }
    if (!data.vendor_name) errors.push("Missing vendor name");
    if (!data.category) errors.push("Missing category");
    if (!data.source) data.source = "Manual Entry";
    if (!data.tags) data.tags = [];
    return { data, raw: row, errors };
  });
}

export function parseTSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split("\t").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (cells[i] ?? "").trim()));
    return obj;
  });
  return { headers, rows };
}

export function dedupeAgainst(
  candidates: ParsedRow[],
  existing: Array<{ vendor_name: string; contact_number: string | null }>,
): { unique: ParsedRow[]; duplicates: number } {
  const seen = new Set(
    existing.map((e) => `${e.vendor_name.toLowerCase()}|${(e.contact_number ?? "").replace(/\D/g, "")}`),
  );
  const unique: ParsedRow[] = [];
  let duplicates = 0;
  for (const r of candidates) {
    const key = `${(r.data.vendor_name ?? "").toLowerCase()}|${(r.data.contact_number ?? "").replace(/\D/g, "")}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    unique.push(r);
  }
  return { unique, duplicates };
}
