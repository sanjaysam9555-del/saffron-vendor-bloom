import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const BASE_CATEGORIES = [
  "Photography & Videography",
  "Decor",
  "Catering",
  "Sound & Lighting",
  "Production & Event Management",
  "Special Effects (SFX)",
  "Makeup Artists",
  "Mehendi Artists",
  "Hospitality & Manpower",
  "Anchors & Emcees",
  "Car Rental & Transport",
  "Hotels & Venues",
  "DJs & Live Music",
  "Miscellaneous",
] as const;

/** @deprecated Use useAllCategories() or getAllCategories() for the merged sorted list. */
export const CATEGORIES = BASE_CATEGORIES;

export type Category = (typeof BASE_CATEGORIES)[number];

// ---------- Storage keys ----------
const CUSTOM_KEY = "saffron.customCategories";
const RENAMES_KEY = "saffron.categoryRenames"; // { [oldName]: newName }
const DELETED_KEY = "saffron.deletedCategories"; // string[] of names hidden from UI

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

// ---------- Low-level storage helpers ----------
function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readCustom(): string[] {
  const v = readJSON<unknown>(CUSTOM_KEY, []);
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function readRenames(): Record<string, string> {
  const v = readJSON<unknown>(RENAMES_KEY, {});
  return v && typeof v === "object" ? (v as Record<string, string>) : {};
}
function readDeleted(): string[] {
  const v = readJSON<unknown>(DELETED_KEY, []);
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

// ---------- Public read API ----------
export function getCustomCategories(): string[] {
  return readCustom();
}

/** Map a stored vendor.category to its current display name (after renames). */
export function getDisplayCategory(name: string | null | undefined): string {
  if (!name) return "";
  const renames = readRenames();
  // follow rename chain (with cycle guard)
  let current = name;
  const seen = new Set<string>();
  while (renames[current] && !seen.has(current)) {
    seen.add(current);
    current = renames[current];
  }
  return current;
}

export function getAllCategories(): string[] {
  const renames = readRenames();
  const deleted = new Set(readDeleted());

  // Apply renames to base + custom, then filter deleted
  const applyRename = (n: string) => getDisplayCategory(n);
  const merged = [
    ...BASE_CATEGORIES.map(applyRename),
    ...readCustom().map(applyRename),
  ].filter((c) => !deleted.has(c));

  const seen = new Set<string>();
  const unique = merged.filter((c) => {
    const k = c.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.sort((a, b) => a.localeCompare(b));
}

// ---------- Mutations ----------
export function addCustomCategory(name: string): { ok: boolean; value?: string; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Category name is required" };
  const existing = getAllCategories().map((c) => c.toLowerCase());
  if (existing.includes(trimmed.toLowerCase())) {
    return { ok: false, error: "Category already exists" };
  }
  // If this name was previously deleted, un-delete it
  const deleted = readDeleted().filter((n) => n.toLowerCase() !== trimmed.toLowerCase());
  writeJSON(DELETED_KEY, deleted);

  const next = [...readCustom(), trimmed];
  writeJSON(CUSTOM_KEY, next);
  notify();
  return { ok: true, value: trimmed };
}

/**
 * Rename a category. Updates local mapping AND bulk-updates every vendor row
 * whose category equals the old name in the database.
 */
export async function renameCategory(
  oldName: string,
  newName: string,
): Promise<{ ok: boolean; value?: string; error?: string }> {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to) return { ok: false, error: "Names are required" };
  if (from === to) return { ok: true, value: to };

  const all = getAllCategories().map((c) => c.toLowerCase());
  if (all.includes(to.toLowerCase()) && to.toLowerCase() !== from.toLowerCase()) {
    return { ok: false, error: "A category with that name already exists" };
  }

  // 1) DB: update all vendors using the old name
  const { error } = await supabase
    .from("vendors")
    .update({ category: to })
    .eq("category", from);
  if (error) return { ok: false, error: error.message };

  // 2) Local: record rename mapping (so future stored "from" values still resolve)
  const renames = readRenames();

  // If renaming a custom category that has no vendors, also update the custom list directly
  const custom = readCustom();
  const customIdx = custom.findIndex((c) => c === from);
  if (customIdx >= 0) {
    custom[customIdx] = to;
    writeJSON(CUSTOM_KEY, custom);
  } else {
    // Base or already-renamed name: store mapping
    renames[from] = to;
    // Also collapse any chains pointing to "from"
    for (const k of Object.keys(renames)) {
      if (renames[k] === from) renames[k] = to;
    }
    writeJSON(RENAMES_KEY, renames);
  }

  // If "to" was previously hidden via delete, un-hide it
  const deleted = readDeleted().filter((n) => n.toLowerCase() !== to.toLowerCase());
  writeJSON(DELETED_KEY, deleted);

  notify();
  return { ok: true, value: to };
}

/**
 * Delete a category. If vendors still use it, they're reassigned to "Miscellaneous".
 * For base categories, hides them from the UI via the deleted-set; for custom
 * categories, removes them outright.
 */
export async function deleteCategory(
  name: string,
  fallback: string = "Miscellaneous",
): Promise<{ ok: boolean; error?: string }> {
  const target = name.trim();
  if (!target) return { ok: false, error: "Name required" };

  // 1) DB: reassign vendors to fallback
  const { error } = await supabase
    .from("vendors")
    .update({ category: fallback })
    .eq("category", target);
  if (error) return { ok: false, error: error.message };

  // 2) Local: remove from custom list if present
  const custom = readCustom().filter((c) => c !== target);
  writeJSON(CUSTOM_KEY, custom);

  // 3) Local: clear any rename pointing TO this name
  const renames = readRenames();
  let changed = false;
  for (const [k, v] of Object.entries(renames)) {
    if (v === target) {
      delete renames[k];
      changed = true;
    }
  }
  if (changed) writeJSON(RENAMES_KEY, renames);

  // 4) Local: hide from UI (covers base categories and any that survive via rename chain)
  const deleted = readDeleted();
  if (!deleted.includes(target)) {
    deleted.push(target);
    writeJSON(DELETED_KEY, deleted);
  }

  notify();
  return { ok: true };
}

// ---------- Subscriptions / hook ----------
export function subscribeCategories(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAllCategories(): string[] {
  const [list, setList] = useState<string[]>(() => getAllCategories());
  useEffect(() => {
    const update = () => setList(getAllCategories());
    update();
    return subscribeCategories(update);
  }, []);
  return list;
}

// ---------- Colors ----------
export function getCategoryColor(name: string): { bg: string; text: string } {
  return CATEGORY_COLORS[name] ?? CATEGORY_COLORS["Miscellaneous"];
}

// Warm, brand-aligned muted hues for category chips (light backgrounds, charcoal text).
export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Photography & Videography":     { bg: "bg-[hsl(11_55%_92%)]",  text: "text-[hsl(11_65%_32%)]" },
  "Decor":                         { bg: "bg-[hsl(140_30%_90%)]", text: "text-[hsl(140_40%_28%)]" },
  "Catering":                      { bg: "bg-[hsl(30_55%_88%)]",  text: "text-[hsl(30_55%_30%)]" },
  "Sound & Lighting":              { bg: "bg-[hsl(260_30%_92%)]", text: "text-[hsl(260_40%_38%)]" },
  "Production & Event Management": { bg: "bg-[hsl(220_30%_92%)]", text: "text-[hsl(220_40%_36%)]" },
  "Special Effects (SFX)":         { bg: "bg-[hsl(320_35%_92%)]", text: "text-[hsl(320_45%_38%)]" },
  "Makeup Artists":                { bg: "bg-[hsl(0_45%_92%)]",   text: "text-[hsl(0_55%_38%)]" },
  "Mehendi Artists":               { bg: "bg-[hsl(120_30%_90%)]", text: "text-[hsl(120_40%_28%)]" },
  "Hospitality & Manpower":        { bg: "bg-[hsl(180_25%_90%)]", text: "text-[hsl(180_40%_28%)]" },
  "Anchors & Emcees":              { bg: "bg-[hsl(290_30%_92%)]", text: "text-[hsl(290_40%_38%)]" },
  "Car Rental & Transport":        { bg: "bg-[hsl(240_20%_92%)]", text: "text-[hsl(240_35%_38%)]" },
  "Hotels & Venues":               { bg: "bg-[hsl(42_55%_88%)]",  text: "text-[hsl(42_65%_30%)]" },
  "DJs & Live Music":              { bg: "bg-[hsl(340_40%_92%)]", text: "text-[hsl(340_50%_38%)]" },
  "Miscellaneous":                 { bg: "bg-[hsl(40_15%_88%)]",  text: "text-[hsl(20_15%_32%)]" },
};

export const LOCATION_OPTIONS = ["Delhi", "Gurugram", "Noida", "Pan India", "Rajasthan", "Other"] as const;
export const SOURCE_OPTIONS = ["Manual Entry", "Inbound Form", "RFP Response", "Reference", "Sample Data"] as const;
export const HOTEL_CATEGORIES = ["Budget", "Mid-Range", "Upper Mid", "Luxury", "Ultra-Luxury"] as const;

export function formatINR(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  const num = Number(n);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(num % 10000000 === 0 ? 0 : 1)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(num % 100000 === 0 ? 0 : 1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(0)}K`;
  return `₹${num}`;
}

export function formatPriceRange(low?: number | null, high?: number | null): string {
  if (low == null && high == null) return "";
  if (low != null && high != null) return `${formatINR(low)} – ${formatINR(high)}`;
  return formatINR(low ?? high);
}
