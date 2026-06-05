## Change

In `src/components/client/ClientSidebar.tsx`:

- Remove the `useAllCategories()` union. The client filter list should only contain categories present in the vendors actually allotted to the client.
- Replace line 34's `categories` derivation with `Object.keys(counts).sort((a, b) => a.localeCompare(b))`.
- Drop the now-unused `useAllCategories` import.

No changes to admin sidebar, types, or filter logic — just the source list for the client-side category list.