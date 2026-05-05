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

// ---------- Legacy local storage keys (used only for one-time migration) ----------
const CUSTOM_KEY = "saffron.customCategories";

let categoryCache = uniqueSort([...BASE_CATEGORIES]);
let fetchPromise: Promise<string[]> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

function uniqueSort(names: string[]): string[] {
  const seen = new Set<string>();
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b));
}

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

function clearLegacyCustom(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CUSTOM_KEY);
}

async function migrateLegacyCustomCategories(names: string[]): Promise<void> {
  const rows = uniqueSort(names).map((name) => ({ name, is_deleted: false }));
  if (!rows.length) return;
  const { error } = await supabase.from("categories").upsert(rows, { onConflict: "name" });
  if (!error) {
    clearLegacyCustom();
    await refreshCategories();
  }
}

// ---------- Public read API ----------
export function getCustomCategories(): string[] {
  const base = new Set(BASE_CATEGORIES.map((c) => c.toLowerCase()));
  return categoryCache.filter((c) => !base.has(c.toLowerCase()));
}

/** Map a stored vendor.category to its current display name. */
export function getDisplayCategory(name: string | null | undefined): string {
  return name ?? "";
}

export function getAllCategories(): string[] {
  return categoryCache;
}

export async function refreshCategories(): Promise<string[]> {
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("name")
      .eq("is_deleted", false)
      .order("name", { ascending: true });

    if (!error) {
      const legacy = readCustom();
      categoryCache = uniqueSort([...(data ?? []).map((row) => row.name), ...legacy]);
      notify();
      if (legacy.length) void migrateLegacyCustomCategories(legacy);
    }

    return categoryCache;
  })().finally(() => {
    fetchPromise = null;
  });

  return fetchPromise;
}

// ---------- Mutations ----------
export async function addCustomCategory(name: string): Promise<{ ok: boolean; value?: string; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Category name is required" };
  const existing = categoryCache.map((c) => c.toLowerCase());
  if (existing.includes(trimmed.toLowerCase())) {
    return { ok: false, error: "Category already exists" };
  }

  const { error } = await supabase
    .from("categories")
    .upsert({ name: trimmed, is_deleted: false }, { onConflict: "name" });
  if (error) return { ok: false, error: error.message };

  categoryCache = uniqueSort([...categoryCache, trimmed]);
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

  const all = categoryCache.map((c) => c.toLowerCase());
  if (all.includes(to.toLowerCase()) && to.toLowerCase() !== from.toLowerCase()) {
    return { ok: false, error: "A category with that name already exists" };
  }

  const { data: updatedCategories, error: categoryError } = await supabase
    .from("categories")
    .update({ name: to, is_deleted: false })
    .eq("name", from)
    .select("id");
  if (categoryError) return { ok: false, error: categoryError.message };

  if (!updatedCategories?.length) {
    const { error: insertError } = await supabase
      .from("categories")
      .upsert({ name: to, is_deleted: false }, { onConflict: "name" });
    if (insertError) return { ok: false, error: insertError.message };
  }

  const { error } = await supabase
    .from("vendors")
    .update({ category: to })
    .eq("category", from);
  if (error) return { ok: false, error: error.message };

  categoryCache = uniqueSort(categoryCache.map((c) => (c === from ? to : c)));
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

  const { error: categoryError } = await supabase
    .from("categories")
    .update({ is_deleted: true })
    .eq("name", target);
  if (categoryError) return { ok: false, error: categoryError.message };

  categoryCache = categoryCache.filter((c) => c !== target);
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
    const unsubscribe = subscribeCategories(update);
    void refreshCategories();

    const channel = supabase
      .channel("categories-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
        void refreshCategories();
      })
      .subscribe();

    return () => {
      unsubscribe();
      void supabase.removeChannel(channel);
    };
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
