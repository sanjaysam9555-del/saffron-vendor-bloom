## Client Dashboard Tweaks

**File:** `src/routes/client.index.tsx`

1. **Remove subtitle copy** — In the welcome header block, remove the "Here are the vendors we think will be perfect for your wedding." sentence shown when no category filter is active. Keep the filter-active variant ("X of Y vendors") intact.

2. **Sidebar collapsed by default** — Change the initial state from `useState(false)` to `useState(true)` for `sidebarCollapsed`, so the filter panel starts closed on desktop. Mobile filter behavior is unaffected (already closed by default).

No other components or business logic touched.