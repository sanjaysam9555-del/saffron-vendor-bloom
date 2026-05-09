## Goal
Convert the "Saffron's Preference" button on the admin project vendor list into a true slider toggle (Switch) with instant, optimistic feedback.

## Changes

**File: `src/routes/admin.projects.$id.tsx`**

Replace the `SaffronPickToggle` component (~lines 375–419):

- Use the existing shadcn `Switch` component (`@/components/ui/switch`) styled as a small slider with a `Sparkles` icon and the label "Saffron's Pick" beside it.
- Drive it from a `useMutation` (already using React Query in this file) instead of local `useState` + `await`. This:
  - Performs an **optimistic update** of the `["project", projectId]` cache so the slider flips instantly without waiting for the server round-trip.
  - Rolls back on error and shows `notifyError`.
  - Calls `notifySuccess` on success and invalidates the query to reconcile.
- Remove the disabled-while-pending behaviour; the optimistic cache makes the UI feel instantaneous. Still guard against double-fires by checking `mutation.isPending` only to prevent piling requests, but keep the Switch interactive.
- Active (on) state: terracotta `data-[state=checked]:bg-[var(--terracotta)]` for visual continuity with the existing pick branding. Off state: muted neutral.
- Tooltip via `title` attribute preserved.

No changes to the server function, types, or client-side display components — only the admin toggle control.

## Out of scope
- Client-facing vendor cards (already render the pick badge from `is_saffron_pick`).
- Database / server function signatures.
