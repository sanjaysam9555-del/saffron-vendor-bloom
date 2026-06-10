Rename the client-side "Time" tab label to "Overview".

## File
- `src/routes/client.index.tsx` line 314: change `<span>Time</span>` → `<span>Overview</span>`.

Also update the `aria-label` on line 305 from `"Timeline view"` → `"Overview"` for accessibility consistency.

No other references to rename — the inner sub-tabs ("Timeline" / "Table") inside `VendorTimeline` stay unchanged.