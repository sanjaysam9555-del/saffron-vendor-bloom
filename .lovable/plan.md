## Goal
On the project detail page (`/admin/projects/$id`), the client login block currently renders open by default at the top of the page. Wrap it in a collapsible section titled **Client credentials** so the page opens with it closed; users expand it to reveal the add-client form and the list of existing logins.

## Changes — `src/routes/admin.projects.$id.tsx` (lines ~207–264)

1. Rename the section heading from **Client login** to **Client credentials** (same label on mobile and desktop).
2. Wrap the entire section in a collapsible container:
   - Header row = clickable button spanning full width, showing the title, a count badge (e.g. `{clients.length} login(s)`), and a chevron that rotates when open.
   - Default state: **collapsed**.
   - Local state: `const [credsOpen, setCredsOpen] = useState(false)`.
3. When collapsed, hide everything below the header (the "Add Client Login" button, the helper text about `/login`, the add-client form, and the credentials table).
4. When expanded, render the existing contents unchanged:
   - "Add Client Login" button (still toggles `showAddClient`)
   - Helper line "Share these credentials with the client…"
   - Inline add-client form (when `showAddClient` is true)
   - Table of existing clients
5. Keep the existing terracotta styling, border, and spacing; the collapsed header should look like a tidy card row consistent with the rest of the page.
6. Use the existing `ChevronDown` icon from `lucide-react` (already used elsewhere) — rotate 180° via a Tailwind class when open.

## Out of scope
- No change to the add-client logic, the table rows, the `ClientRow` component, or any data fetching.
- No change to other sections (project header, vendor tabs, timeline).
