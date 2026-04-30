import { useEffect, useState } from "react";

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

// ---------- Custom-category store (localStorage + pub/sub) ----------
const STORAGE_KEY = "saffron.customCategories";
const listeners = new Set<() => void>();

function readCustom(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeCustom(list: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getCustomCategories(): string[] {
  return readCustom();
}

export function getAllCategories(): string[] {
  const merged = [...BASE_CATEGORIES, ...readCustom()];
  // de-dupe (case-insensitive) preserving first occurrence
  const seen = new Set<string>();
  const unique = merged.filter((c) => {
    const k = c.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.sort((a, b) => a.localeCompare(b));
}

export function addCustomCategory(name: string): { ok: boolean; value?: string; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Category name is required" };
  const all = [...BASE_CATEGORIES, ...readCustom()].map((c) => c.toLowerCase());
  if (all.includes(trimmed.toLowerCase())) {
    return { ok: false, error: "Category already exists" };
  }
  const next = [...readCustom(), trimmed];
  writeCustom(next);
  listeners.forEach((cb) => cb());
  return { ok: true, value: trimmed };
}

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
