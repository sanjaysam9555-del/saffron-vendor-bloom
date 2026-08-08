# Universal search: sharing, history, focus polish, memory, quick filters

Five upgrades to the universal search overlay and the deep-link focus system.

## 1. Copy link on every result

- Each result row gets a small copy icon (appears on hover/focus, always visible on touch).
- Copying builds the full shareable URL for that record: origin + route + the same `tab` / `v` / `focus` / `date` params the result would navigate to.
- A toast confirms "Link copied"; opening the link later lands on the exact page with the record focused and highlighted.
- Keyboard shortcut inside the overlay: `Cmd/Ctrl + C` copies the highlighted result instead of opening it.

## 2. Real back/forward behaviour

- Opening a deep-linked view pushes one history entry, so Back returns to where you were instead of dumping you at the top of a param-less page.
- Closing a focused view (vendor sheet, alert group, calendar day) rolls history back when the deep link was the entry that opened it, and otherwise strips the params without adding noise.
- Browser Back/Forward clears or reapplies the focus params correctly — reopening a sheet on Forward, closing it on Back.
- Scroll position of the list behind the sheet is captured before the jump and restored when the params are cleared.

## 3. Better, consistent focus highlight

- One shared highlight treatment: a soft terracotta wash that fades in, a ring that pulses twice, then settles — instead of the current hard outline.
- Centering becomes consistent everywhere by accounting for the sticky headers and the mobile tab bar, and by scrolling the nearest scrollable container (tables and boards scroll inside their own panes, not the page).
- The same targeting is applied to all seven record types: vendors (card, table row, board), quotes, tasks (board card and table row), comments, calendar entries and alerts.
- Respects reduced-motion: highlight still appears, without the pulse.

## 4. Remember the last query and filters per device

- The overlay reopens with your previous query pre-filled and selected (typing replaces it instantly) plus the filter chips you last used.
- Stored per device in browser storage, alongside the existing recent-searches list; cleared when you sign out.

## 5. Quick filters inside the overlay

- A chip row under the input: All, Vendors, Projects, Quotes, Tasks, Comments, Calendar, Alerts.
- Chips are multi-select; results narrow instantly (client-side over the already-fetched results, so no extra round trip) and each chip shows its match count.
- Chips that have no matches for the current query render dimmed and non-interactive.
- Keyboard: `Tab` moves into the chip row, `1`–`7` toggle categories directly.

## Technical notes

- `src/components/search/UniversalSearch.tsx` — chips state, per-result copy button, copy shortcut, filtered grouping, restore of saved query/filters on open.
- `src/lib/universal-search-store.ts` — add `readSearchPrefs` / `writeSearchPrefs` (last query + selected kinds) next to the recent-search helpers; clear on sign-out.
- Shareable URL built with the router's `buildLocation` from `hit.to` + `hit.search`, prefixed with `window.location.origin`; clipboard write with a text-selection fallback for older iOS.
- `src/lib/deep-link.ts` — extend `useFocusTarget` to resolve the nearest scrollable ancestor, offset by a `--focus-scroll-offset` CSS var set by the layouts, and expose a `clearFocus` helper that prefers `history.back()` when the deep link created the current entry, falling back to a `replace` navigation.
- `src/styles.css` — replace `.deep-link-focus` with the layered wash + ring keyframes and add `scroll-margin-block` for focus targets.
- Consumers already wired (`admin.index`, `admin.projects.$id.index`, `admin.notifications`, `admin.calendar`, `client.index`) switch their local `clearDeepLink` implementations to the shared helper; scroll capture/restore lives in the same helper.
- No backend or schema changes; `src/server/universal-search.server.ts` stays as is.
