## Diagnosis

The Instagram bulk cache is already fetched using the **unfiltered** vendor id list (`admin.index.tsx` line 70-75), so switching a category filter does not clear the preview data. The `previewMap.get(v.id)` still returns the correct row after filtering — the row's header (avatar, name, bio) is proof of that in the screenshot.

The failure is at the thumbnail `<img>` level:

- `VendorInstagramCardStrip` renders each thumb through `SafeImg`, which uses `<img loading="lazy" ...>`.
- The card grid is rendered inside `VirtualGrid`, whose rows are **absolutely positioned with a `translateY` transform** inside a tall `totalHeight` container.
- After a category filter is applied, the parent container shrinks and rows are re-positioned. Browsers' `loading="lazy"` intersection heuristic frequently mis-detects these transformed rows as off-screen and never fires the fetch, leaving the anchor's cream `bg-[var(--cream-deep)]` background as a blank square.
- The same symptom appears on other pages that also mount the strip inside virtualized or animated containers.

Secondary issue: `SafeImg` keeps its `ok` state across src changes because the component isn't keyed by `src`. If a URL failed once (e.g. an expired CDN link before mirroring), a later refresh with a good storage URL still renders the fallback icon or blank state.

## Fix

Scope stays in the presentation layer — no data or server-fn changes.

1. **`src/components/vendor/VendorInstagramPreview.tsx`**
   - Drop `loading="lazy"` on card-strip thumbnails and the avatar (keep it on the detail-drawer variant where lazy is fine). These are ~60×60 images already known to be visible.
   - Add `decoding="async"` so decode still stays off the main thread.
   - Reset `SafeImg`'s error state whenever `src` changes (either `useEffect` reset or, simpler, key the component by `src` at the call site) so a previously-failed URL doesn't poison the next render.
   - Add a subtle low-opacity Instagram glyph inside each thumb anchor as a base layer, so even a slow image load never leaves a completely empty grey square.

2. **`src/components/ui/VirtualGrid.tsx`**
   - Bump `overscan` default (or override at call sites that render the vendor strip) so mounted rows extend well past the viewport, reducing the chance that lazy/intersection logic in browsers considers the transformed row off-screen when the grid reflows after a filter change.

3. **Sanity re-check after fix**
   - Verify by loading `/admin`, applying a category filter, and confirming thumbnails appear immediately on the first three cards. Repeat with a different filter to confirm no regression on toggle.

No changes to `useInstagramPreviewsBulk`, the mirror pipeline, or the proxy route.
