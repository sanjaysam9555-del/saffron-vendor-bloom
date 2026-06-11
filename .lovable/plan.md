## Problem

In the desktop horizontal timeline, the first card ("Hotels & Venues" in the screenshot) is clipped on the left edge of the scroll container. The card is positioned at `left = x - CARD_W/2` where `x = days_from_start * 6 + 24`. Because the start of the axis only has 24px of left padding while a card is 180px wide (90px half-width), any item dated in the first ~11 days of the timeline range renders with a negative `left` and gets cut off.

## Fix

In `HorizontalTimeline` inside `src/components/timeline/VendorTimeline.tsx`:

1. Increase the axis left padding so the earliest card never starts before the visible area. Change the `+ 24` offset inside `xFor` to `CARD_W / 2 + 16` (= 106 px). Apply the same padding on the right side by adding `CARD_W / 2 + 16` to `width` instead of the current `+ 80`.
2. Keep all existing positioning math (month ticks, today line, wedding marker, connectors) — they all derive from `xFor`, so bumping the offset shifts them consistently and nothing else needs to move.

No new tokens, no responsive logic changes, no behavior change beyond eliminating the left-edge clipping.

## Out of scope

Mobile/vertical timeline, table view, and card collision rules.
