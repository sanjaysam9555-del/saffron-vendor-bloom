# Plan — Fix iOS status bar overlap in installed PWA

## Problem

The root layout sets `viewport-fit=cover` so the cream background stretches edge-to-edge on iPhones with a notch/Dynamic Island. But no page reserves space for the iOS status bar, so when launched from the home screen (`display: standalone`), the time, signal, and battery icons sit on top of page content (header text, "Back" links, etc.).

This only happens in the installed PWA — the in-browser preview and Safari tab are fine because Safari already reserves the status bar area.

## Fix

Add a global safe-area padding rule in `src/styles.css`, scoped to `display-mode: standalone` so it only affects the home-screen app and never the browser/preview:

```css
@media all and (display-mode: standalone) {
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    background-color: var(--cream);
  }
}
```

Plus a Safari fallback that guarantees a minimum 44px top inset on older iOS (where `env()` sometimes returns 0 if not opted in correctly):

```css
@supports (-webkit-touch-callout: none) {
  @media all and (display-mode: standalone) {
    body { padding-top: max(env(safe-area-inset-top), 44px); }
  }
}
```

The `background-color: var(--cream)` on body ensures the inset region behind the status bar is the same cream color as the dashboard — no white strip, no visible status bar background.

## Why this approach

- **One rule covers every page** — no per-route edits needed.
- **Browser preview untouched** — Lovable's preview iframe is not in standalone mode, so the rule is inert there.
- **Bottom + sides handled too** — home indicator on Face ID iPhones and landscape notches are also covered.
- **`apple-mobile-web-app-status-bar-style` stays `default`** — keeps dark text on cream, matching the brand. (Switching to `black-translucent` would put the status bar over content with no inset, which is the opposite of what we want.)

## Files changed

- `src/styles.css` — append the two `@media (display-mode: standalone)` blocks after the existing `@layer base` rules (around line 110).

No changes to `__root.tsx`, `site.webmanifest`, or any route file. The existing `viewport-fit=cover` and `apple-mobile-web-app-capable` meta tags stay as-is.
