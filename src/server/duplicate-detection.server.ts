import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DuplicateField =
  | "vendor_name"
  | "contact_number"
  | "email"
  | "instagram_handle"
  | "website";

export interface DuplicateMatch {
  field: DuplicateField;
  message: string;
}

const FIELD_LABELS: Record<DuplicateField, string> = {
  vendor_name: "vendor name",
  contact_number: "contact number",
  email: "email address",
  instagram_handle: "Instagram handle",
  website: "website",
};

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeEmail(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Strip everything but digits, then keep last 10 (handles +91, 0, country codes). */
export function normalizePhone(s: string | null | undefined): string {
  const digits = (s ?? "").replace(/\D+/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeInstagram(s: string | null | undefined): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .replace(/\/.*$/, "")
    .replace(/\?.*$/, "");
}

export function normalizeWebsite(s: string | null | undefined): string {
  let v = (s ?? "").trim().toLowerCase();
  if (!v) return "";
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "");
  // strip path/query
  v = v.split("/")[0].split("?")[0];
  return v.replace(/\/$/, "");
}

interface VendorLookup {
  vendor_name?: string | null;
  contact_number?: string | null;
  email?: string | null;
  instagram_handle?: string | null;
  website?: string | null;
}

function messageFor(field: DuplicateField): string {
  return `A vendor with this ${FIELD_LABELS[field]} is already registered with us.`;
}

/**
 * Check the vendors table for a duplicate using normalized comparison.
 * Returns the first matching field (priority: name → phone → email → instagram → website).
 *
 * Pulls all vendor fields once and matches in JS so normalization stays
 * consistent. Uses paged reads to safely handle large tables.
 */
export async function findDuplicateVendor(
  input: VendorLookup,
): Promise<DuplicateMatch | null> {
  const target = {
    vendor_name: normalizeName(input.vendor_name),
    contact_number: normalizePhone(input.contact_number),
    email: normalizeEmail(input.email),
    instagram_handle: normalizeInstagram(input.instagram_handle),
    website: normalizeWebsite(input.website),
  };

  // Skip empties
  const checking: DuplicateField[] = [];
  if (target.vendor_name) checking.push("vendor_name");
  if (target.contact_number && target.contact_number.length >= 7) checking.push("contact_number");
  if (target.email) checking.push("email");
  if (target.instagram_handle) checking.push("instagram_handle");
  if (target.website) checking.push("website");
  if (!checking.length) return null;

  const PAGE = 1000;
  let from = 0;
  // Cap pages to avoid runaway queries; 10 pages * 1000 = 10k vendors which is far above current scale.
  for (let page = 0; page < 10; page++) {
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .select("vendor_name, contact_number, email, instagram_handle, website")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const row of data) {
      for (const field of checking) {
        const stored = (() => {
          switch (field) {
            case "vendor_name": return normalizeName(row.vendor_name);
            case "contact_number": return normalizePhone(row.contact_number);
            case "email": return normalizeEmail(row.email);
            case "instagram_handle": return normalizeInstagram(row.instagram_handle);
            case "website": return normalizeWebsite(row.website);
          }
        })();
        if (stored && stored === target[field]) {
          return { field, message: messageFor(field) };
        }
      }
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return null;
}

/**
 * Check a single field for duplicates. Used by the lightweight pre-check endpoint.
 */
export async function fieldHasDuplicate(
  field: DuplicateField,
  rawValue: string,
): Promise<boolean> {
  const lookup: VendorLookup = {};
  lookup[field] = rawValue;
  const match = await findDuplicateVendor(lookup);
  return match?.field === field;
}

export function duplicateMessageFor(field: DuplicateField): string {
  return messageFor(field);
}
