## Goal
1. Replace favicon/PWA icon assets with the newly uploaded Saffron branding files.
2. Replace the "Loading…" dots indicator on every branded splash screen with a gentle pulse animation on the "Saffron Planning Studio" wordmark itself.

## Changes

### 1. Favicon & PWA assets
Copy the seven uploaded files into `public/`, overwriting current ones:
- `user-uploads://android-chrome-192x192-3.png` → `public/android-chrome-192x192.png`
- `user-uploads://android-chrome-512x512-3.png` → `public/android-chrome-512x512.png`
- `user-uploads://apple-touch-icon-3.png` → `public/apple-touch-icon.png`
- `user-uploads://favicon-16x16-3.png` → `public/favicon-16x16.png`
- `user-uploads://favicon-32x32-3.png` → `public/favicon-32x32.png`
- `user-uploads://favicon-3.ico` → `public/favicon.ico`
- `user-uploads://site-2.webmanifest` → `public/site.webmanifest`

No code changes needed — these paths are already wired in `index.html` / root head.

### 2. Pulsing splash wordmark
Edit `src/components/BrandSplash.tsx`:
- Remove the entire `showLoading` "Loading + dots" block.
- Keep the `showLoading` prop for backward compatibility (callers like `index.tsx` still pass `false` for the opening plate), but repurpose it: when `true`, apply a gentle pulse animation class to the "Saffron Planning Studio" wordmark; when `false`, render it static (opening plate stays calm, no implied work).
- Add a new keyframe `saffron-wordmark-pulse` in `src/styles.css` — opacity + subtle scale oscillation, ~2s ease-in-out infinite (medium tempo, respects `prefers-reduced-motion`).
- Drop the now-unused `saffron-dot-cycle` keyframe from `styles.css`.

No changes to `RouteProgress.tsx` or `index.tsx` callers — they continue to render `<BrandSplash />` / `<BrandSplash showLoading={false} />` exactly as before; behavior just shifts from dots to pulse.

## Out of scope
- Updating manifest `name`/`short_name` strings (manifest is overwritten as-uploaded; user provided the file content).
- Changing splash colors, layout, or the "Wedding & Event Planning" tagline.
