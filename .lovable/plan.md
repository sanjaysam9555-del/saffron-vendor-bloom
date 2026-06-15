## Problem

On the desktop Horizontal Timeline, the wedding-date marker (heart + "JAN 15, 2027" label) sits centered on the axis at `weddingX`. Cards placed below the axis are rendered after the marker in JSX, and any card whose horizontal span covers `weddingX` paints on top of the heart and its date label (visible in the screenshot: the Heaters card hides "JAN 15, 2027").

## Fix (single file: `src/components/timeline/VendorTimeline.tsx`, `HorizontalTimeline`)

1. **Reserve a horizontal "no-card" zone around the wedding marker** so cards don't sit underneath it.
   - Add a small reserved half-width constant (`WEDDING_RESERVE = 28`, enough for the 40px heart circle plus the date label margins).
   - In the lane-packing loop (lines ~1790-1804), if a card's `[leftEdge, rightEdge]` interval intersects `[weddingX - WEDDING_RESERVE, weddingX + WEDDING_RESERVE]`, treat that x-range as occupied in the chosen lane (push the lane's right-edge to `weddingX + WEDDING_RESERVE` and try the next lane if needed). This keeps lane 0 clear directly under/over the heart and pushes conflicting cards onto a new lane.

2. **Raise the wedding marker above cards** as a safety net:
   - Wrap the marker container with `z-20` (cards currently sit at default stacking; dots use `z-10`).
   - Keep card connectors/dots untouched.

3. **No layout regressions for the empty case**: only apply the reservation when `weddingX` is within the rendered axis range; skip otherwise.

## Out of scope

- Ribbon view, Unscheduled band, and mobile views (issue is specific to `HorizontalTimeline`).
- No changes to data, server functions, or other components.
