## Goal

Make the client portal feel like the admin dashboard — same sidebar + top-nav + card-grid + detail-modal layout, but filtered to the vendors assigned to that client and with a strict whitelist of visible fields. Add the missing fields the user pointed out (location, attached documents) to the client card.

## Visible Fields (Client Whitelist)

Add `location` to what `getMyProject` returns and to what's shown on the card/detail. Final whitelist for clients:

- Category, Subcategory
- Vendor Name
- **Location** (newly exposed)
- Instagram
- Price
- Portfolio link
- Attachments (file name, size, downloadable link)

Hidden from clients: phone, email, commission, remarks, source, rating, quote breakdown, team size, deliverables, hotel-specific internal fields, dates added, etc.

## UI Layout (matches admin)

```text
┌──────────────────────────────────────────────────────────────┐
│  [Logo] Saffron Events    "Bride & Groom · 12 Jan 2027"  [⎋]│  ← TopNav
├──────────┬───────────────────────────────────────────────────┤
│ Filters  │  Welcome — vendors picked for you                 │
│  ─────   │                                                   │
│  All     │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  Decor   │  │ card │ │ card │ │ card │ │ card │              │
│  Photog. │  └──────┘ └──────┘ └──────┘ └──────┘              │
│  Venues  │                                                   │
│  …       │                                                   │
│ Location │                                                   │
│ [chips]  │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

- Left sidebar (collapsible, same chevron behavior as admin) with Category list + Location chips, both scoped to the client's assigned vendors only.
- Top nav with Saffron Events logo, vendor search box, project header (Bride & Groom + date) on the right, and a Sign-out icon button replacing the admin's UserMenu/Add Vendor.
- Main area: card grid (2/3/4 cols responsive) with the same card visual language as admin but limited fields.
- Clicking a card opens a read-only detail modal (no Edit/Delete/Copy-Card, no Project Assigner).

## Files to Create

1. `src/components/client/ClientTopNav.tsx`
   Logo + project title (Bride & Groom + formatted date) + search input + sign-out button. No "Add Vendor", no UserMenu, no stats counters.

2. `src/components/client/ClientSidebar.tsx`
   Same visual structure as `Sidebar.tsx` but:
   - Categories list derived from the client's assigned vendors (no "Manage" button, no `useAllCategories`).
   - Location chips derived from distinct locations present in the assigned vendors (instead of static `LOCATION_OPTIONS`).
   - Same collapsed/expanded behavior + chevron.

3. `src/components/client/ClientVendorCard.tsx`
   Read-only card. Shows: category + subcategory chips, vendor name, **location (with MapPin icon)**, price (terracotta), Instagram link, Portfolio link, and an **attachments preview** (icon + count, e.g. "📎 3 documents") at the bottom. Entire card is clickable to open the detail modal. No phone, no rating, no edit button, no project assigner.

4. `src/components/client/ClientVendorDetail.tsx`
   Read-only modal. Header: category + subcategory + vendor name. Rows: Location, Instagram (link), Portfolio (link), Price. Attachments section reuses the same `DocumentViewer` flow as admin so clients can preview/download. No edit/delete/copy buttons, no project assigner, no internal fields.

## Files to Modify

5. `src/server/projects.functions.ts` — `getMyProject`
   Add `location` to the vendors select and to the returned mapped object.

6. `src/lib/project-types.ts` — `ClientVendor`
   Add `location: string | null`.

7. `src/routes/client.index.tsx`
   Replace the current single-page layout with the admin-style shell:
   - State: `search`, `filters: { category, locations[] }`, `sidebarCollapsed`, `detail` (selected vendor).
   - Compose `ClientTopNav` + `ClientSidebar` + main grid + `ClientVendorDetail`.
   - Filter logic identical to admin index (search across name/location/instagram, category match, location includes).
   - Empty states preserved (no project / no vendors / no matches).

## Security Notes

- Whitelist enforced server-side in `getMyProject`. Client component only ever receives whitelisted fields, so even if UI accidentally tries to render a hidden field, nothing leaks.
- RLS on `vendor_attachments` already restricts clients via `client_can_view_vendor`, so signed URLs / public bucket downloads continue to work without extra changes.
- No new tables, migrations, or RLS changes required.

## Out of Scope

- Admin-side changes (no edits to the existing admin dashboard, sidebar, or vendor card).
- No new fields exposed beyond `location`.
- No table/spreadsheet view for clients (cards only — simpler for non-technical users).