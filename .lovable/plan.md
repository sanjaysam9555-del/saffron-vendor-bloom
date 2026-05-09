## Goal

A foundational UX polish pass across the whole app: every destructive action gets a confirm dialog, every successful action gets a toast plus a small inline animation, every async list/detail shows skeletons instead of blank flashes, lists with no data show friendly empty states, and forms get validation polish. Auth flows (login, signup, logout) get the same treatment.

## What gets built

### 1. Shared primitives (one-time)

- **`<ConfirmDialog>`** — wrapper around the existing `AlertDialog` with `title`, `description`, `confirmLabel`, `destructive`, async `onConfirm` (handles loading + close). Replaces every `window.confirm(...)`.
- **`useConfirm()`** hook — imperative API: `const confirm = useConfirm(); if (await confirm({...})) { ... }`. Keeps call sites clean.
- **`<EmptyState>`** — icon + title + description + optional CTA. Reused across all empty lists.
- **`<SectionSkeleton>` / `<RowSkeleton>` / `<CardSkeleton>`** — composed from existing `Skeleton` primitive for consistent loading states.
- **`<SuccessFlash>`** — tiny inline check-mark + fade animation used after save/delete on the affected row, card, or button. Driven by a `flashId` prop.
- **Animation utilities** in `src/styles.css` — `success-pop`, `flash-bg`, `fade-in`, `scale-in` keyframes. Used by `SuccessFlash` and applied via Tailwind `animate-*` classes.
- **Toast helpers** in `src/lib/ui/feedback.ts` — `notifySuccess(msg)`, `notifyError(err, fallback)` to standardize wording (avoids the current ad-hoc `e instanceof Error ? ...` repetition).

### 2. Replace every `window.confirm`

Six current sites, all swapped to `ConfirmDialog`:

- `admin.users.tsx` — delete user
- `admin.projects.$id.tsx` — delete project, remove client
- `VendorCommentsThread.tsx` — delete comment
- `ProjectVendorQuotesPanel.tsx` — delete quote, delete quote file
- Plus add confirms where missing: vendor delete (`VendorDetail`), bulk vendor delete (`BulkActionBar` already has its own — verify), remove vendor from project, project-vendor unassign, attachment delete in `VendorForm`.

### 3. Success feedback everywhere

For every mutation (create/update/delete/upload/status-change/comment/quote/login/signup/logout), wire:

- `notifySuccess("X created")` toast
- `SuccessFlash` on the affected row/card/button for ~800ms
- Replace silent successes (e.g. status pill change, comment add, quote add, profile save) with the same pattern

Concrete files touched:
- `lib/auth.tsx` — toast on login success ("Welcome back"), signup ("Account created"), logout ("Signed out").
- `client.index.tsx`, `ClientTopNav.tsx`, `UserMenu.tsx` — confirm on logout, toast after.
- `admin.index.tsx`, `admin.submissions.tsx`, `admin.projects.*`, `admin.users.tsx` — toasts on every save/add/edit/delete/assign/unassign.
- `VendorForm`, `BulkEditDialog`, `ProjectVendorQuotesPanel`, `VendorCommentsThread`, `useSetVendorStatus`, `vendor-signup.tsx` — success toasts + inline flash on the row.

### 4. Loading / skeleton states

Replace blank flashes with skeletons in:
- Client dashboard grid, board, table views
- Client vendor detail panel
- Admin vendor list, vendor detail, submissions, users, projects index, project detail
- Quote panels, comments thread

Buttons that trigger async actions get a small spinner + disabled state while pending (use existing `Loader2` from lucide).

### 5. Empty states

Friendly `EmptyState` for: client dashboard with no vendors, project with no vendors assigned, project with no clients, vendor with no quotes, vendor with no comments, admin users list empty, submissions list empty, search/filter returning zero results.

### 6. Form validation polish

- Inline error messages under fields (not just toasts) in: `vendor-signup`, login, signup, project create, vendor create/edit, quote add/edit, client invite, password reset.
- Disable submit button while invalid or pending; show spinner while submitting; show success state briefly after.
- Use existing `react-hook-form` patterns where present; add lightweight inline error rendering otherwise.

## Out of scope (explicit)

- No design-system rework (colors, typography, layout stay as-is).
- No new features or routes.
- No backend / RLS / migration changes.
- Email and other server-side flows untouched.

## Technical notes

- `sonner` is already wired — keep using `toast.success` / `toast.error` via the new `notifySuccess` / `notifyError` helpers for consistent copy.
- `AlertDialog` primitive already present — `ConfirmDialog` is a thin wrapper, no new deps.
- Animations live in `src/styles.css` as keyframes + Tailwind utility classes; no `framer-motion` dependency added (kept lightweight).
- Skeletons reuse the existing `Skeleton` component; we just add composed variants.
- All work is presentational — server functions, queries, RLS, schemas remain untouched.

## Sequencing

1. Build shared primitives (`ConfirmDialog`, `useConfirm`, `EmptyState`, skeleton variants, `SuccessFlash`, feedback helpers, animation keyframes).
2. Sweep every `window.confirm` → `ConfirmDialog`.
3. Sweep every mutation → toast + flash, including auth.
4. Add skeletons to every async list / detail.
5. Add empty states.
6. Form validation polish pass.
7. Spot-check the main flows in preview.