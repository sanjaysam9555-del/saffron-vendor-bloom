/**
 * Studio branding — name, primary colour and display font.
 *
 * Persisted to localStorage and applied by overriding the CSS custom
 * properties the stylesheet already reads (`--terracotta`, `--font-display`).
 *
 * NOTE: this is per-browser, not shared across users. A migration for a
 * `studio_settings` table ships alongside this (see
 * supabase/migrations/*_studio_settings.sql) — once applied, swap the read and
 * write helpers here for that table and every user sees the same branding.
 */

const KEY = "saffron.studio.theme.v1";

export interface StudioTheme {
  brandName: string;
  primaryColor: string; // key into PRIMARY_COLORS
  displayFont: string; // key into DISPLAY_FONTS
}

export const DEFAULT_THEME: StudioTheme = {
  brandName: "Saffron Planning Studio",
  primaryColor: "terracotta",
  displayFont: "cormorant",
};

/** Primary colour presets. `hsl` replaces `--terracotta` at runtime. */
export const PRIMARY_COLORS: Record<string, { label: string; hsl: string; soft: string }> = {
  terracotta: { label: "Terracotta (default)", hsl: "hsl(11 65% 38%)", soft: "hsl(11 65% 38% / 0.12)" },
  saffron: { label: "Saffron", hsl: "hsl(28 74% 44%)", soft: "hsl(28 74% 44% / 0.12)" },
  rose: { label: "Rose", hsl: "hsl(347 55% 42%)", soft: "hsl(347 55% 42% / 0.12)" },
  plum: { label: "Plum", hsl: "hsl(320 32% 38%)", soft: "hsl(320 32% 38% / 0.12)" },
  emerald: { label: "Emerald", hsl: "hsl(158 45% 30%)", soft: "hsl(158 45% 30% / 0.12)" },
  indigo: { label: "Indigo", hsl: "hsl(236 40% 42%)", soft: "hsl(236 40% 42% / 0.12)" },
};

/**
 * Display-font presets. Only families already loaded by the app are offered —
 * a preset naming an unloaded webfont would silently fall back to serif.
 */
export const DISPLAY_FONTS: Record<string, { label: string; stack: string }> = {
  cormorant: { label: "Cormorant Garamond (default)", stack: '"Cormorant Garamond", serif' },
  jost: { label: "Jost", stack: '"Jost", system-ui, sans-serif' },
  georgia: { label: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  system: { label: "System sans", stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
};

export function readTheme(): StudioTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<StudioTheme>;
    return {
      brandName: parsed.brandName?.trim() || DEFAULT_THEME.brandName,
      primaryColor: parsed.primaryColor && PRIMARY_COLORS[parsed.primaryColor]
        ? parsed.primaryColor
        : DEFAULT_THEME.primaryColor,
      displayFont: parsed.displayFont && DISPLAY_FONTS[parsed.displayFont]
        ? parsed.displayFont
        : DEFAULT_THEME.displayFont,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(theme: StudioTheme) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(theme));
  } catch {
    /* quota or private mode — the applied theme still holds for this session */
  }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("saffron:theme", { detail: theme }));
}

/** Push the theme onto the document so every `var(--terracotta)` picks it up. */
export function applyTheme(theme: StudioTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const color = PRIMARY_COLORS[theme.primaryColor] ?? PRIMARY_COLORS.terracotta;
  const font = DISPLAY_FONTS[theme.displayFont] ?? DISPLAY_FONTS.cormorant;
  root.style.setProperty("--terracotta", color.hsl);
  root.style.setProperty("--terracotta-soft", color.soft);
  root.style.setProperty("--font-display", font.stack);
}
