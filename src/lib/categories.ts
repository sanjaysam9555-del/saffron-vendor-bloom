export const CATEGORIES = [
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

export type Category = (typeof CATEGORIES)[number];

// Distinct muted hues per category (HSL-ish via Tailwind arbitrary values).
export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Photography & Videography": { bg: "bg-[oklch(0.42_0.12_25)]", text: "text-[oklch(0.95_0.04_25)]" },
  "Decor":                      { bg: "bg-[oklch(0.42_0.10_140)]", text: "text-[oklch(0.95_0.04_140)]" },
  "Catering":                   { bg: "bg-[oklch(0.45_0.13_55)]", text: "text-[oklch(0.97_0.04_55)]" },
  "Sound & Lighting":           { bg: "bg-[oklch(0.40_0.12_270)]", text: "text-[oklch(0.95_0.04_270)]" },
  "Production & Event Management": { bg: "bg-[oklch(0.40_0.10_220)]", text: "text-[oklch(0.95_0.04_220)]" },
  "Special Effects (SFX)":      { bg: "bg-[oklch(0.42_0.14_320)]", text: "text-[oklch(0.95_0.04_320)]" },
  "Makeup Artists":             { bg: "bg-[oklch(0.45_0.10_10)]", text: "text-[oklch(0.97_0.03_10)]" },
  "Mehendi Artists":            { bg: "bg-[oklch(0.40_0.12_120)]", text: "text-[oklch(0.95_0.04_120)]" },
  "Hospitality & Manpower":     { bg: "bg-[oklch(0.42_0.08_180)]", text: "text-[oklch(0.95_0.03_180)]" },
  "Anchors & Emcees":           { bg: "bg-[oklch(0.45_0.12_290)]", text: "text-[oklch(0.96_0.04_290)]" },
  "Car Rental & Transport":     { bg: "bg-[oklch(0.38_0.06_240)]", text: "text-[oklch(0.95_0.03_240)]" },
  "Hotels & Venues":            { bg: "bg-[oklch(0.42_0.10_75)]", text: "text-[oklch(0.97_0.04_75)]" },
  "DJs & Live Music":           { bg: "bg-[oklch(0.42_0.13_340)]", text: "text-[oklch(0.96_0.04_340)]" },
  "Miscellaneous":              { bg: "bg-[oklch(0.40_0.02_60)]", text: "text-[oklch(0.95_0.01_60)]" },
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
