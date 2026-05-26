## 1. Reorder desktop admin header

Right cluster, **left → right**: **Bell · Switcher · Admin · Logout (icon-only)**. Logout sits at the extreme right.

Changes:
- `src/components/admin/AdminShellHeader.tsx`:
  - Remove the standalone desktop `DashboardSwitch` slot next to the logo (the one wrapped in `hidden sm:block`).
  - In the right `ml-auto` cluster, render in this order: `NotificationsBell`, `DashboardSwitch` (desktop-only wrapper `hidden sm:flex`), Admin link, Logout button.
  - Mobile row at the bottom keeps the full-width `DashboardSwitch` as today.
- `src/components/UserMenu.tsx`:
  - Split rendering so the header can place Admin and Logout as separate siblings (either export `AdminLink` + `LogoutButton`, or accept a `part` prop). Admin link keeps current styling.
  - Convert Logout to an icon-only square button on all breakpoints (`LogOut` icon, `aria-label="Sign out"`, `title="Sign out"`), removing the "Logout" text.

No business-logic changes.

## 2. Fix "Preview as client" button

**Root cause:** Recent security work changed `ClientVendorDetail.tsx` to call `listMyProjectVendorQuotes`, whose handler runs `requireClientUser()`. When an admin opens the preview page (`/admin/projects/$id/preview/$clientId`) and clicks a vendor card to open the detail panel, the quotes query fires as the admin user — `requireClientUser` rejects with *"This account is not a client account"*, breaking the detail view inside the preview.

**Fix:** Branch on the existing `useClientPreview()` flag.

Changes:
- `src/server/projects.functions.ts`: add `getProjectVendorQuotesForPreview` server fn — staff-gated (`attachAuthToken` + `requireSupabaseAuth` + `assertStaff`), takes `{ project_id, vendor_id }`, returns the same `{...quote, files: [...]}` shape as `listMyProjectVendorQuotes`.
- `src/components/client/ClientVendorDetail.tsx`: read `useClientPreview()`; in the quotes `useQuery`, call the staff function when `isPreview`, otherwise the client function. Include the `preview` flag in `queryKey` to keep caches separate.

No DB migration, no RLS change.

## Verification
- Header: at desktop ≥640px confirm the right cluster reads Bell · Switcher · Admin · Logout-icon, with Logout pinned to the right edge. At <640px the switcher row still appears under the header.
- Preview: as admin, open a project → click the eye icon on a client row → on the preview page, click a vendor card → vendor detail opens with quotes section loading cleanly (no "not a client account" error).
