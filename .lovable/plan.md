## Fix mobile horizontal overflow in Vendor Detail modal

### Problem
On mobile, the vendor detail card's content (Price text, Remarks, Instagram URL) extends beyond the right edge of the modal. Cause: grid cells and value containers don't constrain their min-width, and long unbroken strings (URLs, long sentences using `truncate` in a flex row) push past the cell. Inside a CSS grid, items default to `min-width: auto`, so `truncate`/`overflow-hidden` on children doesn't actually constrain them — the cell grows to fit the content.

### Changes — `src/components/vendor/VendorDetail.tsx` only
1. Add `min-w-0` to each grid cell (the `Row` wrapper `div`) so children can shrink below content width.
2. Add `min-w-0` to the inner flex row that holds the value + copy button, so `truncate` actually clips.
3. For the Remarks block (which uses `whitespace-pre-wrap`), add `break-words` / `overflow-wrap-anywhere` so long unbroken strings wrap instead of overflowing.
4. For the Instagram preview "No preview cached yet … long URL" block in `VendorInstagramDetailBlock`, ensure the URL wraps (`break-all` on the anchor) — confirm by reading that file; if it's the source of the long URL overflow, apply the same fix there.

### Out of scope
- No layout/structure changes, no desktop changes, no logic changes. Pure CSS class fix.
