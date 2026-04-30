## Saffron Events — Vendor Management Dashboard

A premium, brand-styled internal tool to replace the messy Google Sheet. Backed by Lovable Cloud (Postgres) so data persists across devices and the team can collaborate.

### Brand & design system

- Palette: charcoal `#1A1A1A` background, gold `#C9A84C` primary accent, white text, soft cream `#F5F0E8` card surfaces
- Type: Cormorant Garamond (headings) + Inter (body), loaded from Google Fonts
- Cards: 12px radius, soft shadow, gold border on hover, smooth transitions
- 14 distinct muted category badge colors (not all gold)
- Lucide icons throughout
- Responsive desktop + tablet (sidebar collapses on narrow widths)

### Data model (Postgres)

`vendors` table with all fields from the spec:
- id, vendor_name, category, subcategory, location, contact_number, email, instagram_handle, website, google_rating, price_range_low, price_range_high, commission_model, portfolio_link, source, remarks, tags (text[]), date_added
- Hotel fields: number_of_rooms, distance_from_delhi, hotel_category
- Photography RFP fields: quote_breakdown, team_size, deliverables

`inbound_leads` table: timestamp, name, services, location, contact, instagram, email, portfolio, status (new / converted / dismissed)

Open access to start (no login). RLS enabled with permissive policies — easy to lock down later when team auth is added.

### Routes

```text
/                  Dashboard (vendor grid + sidebar filters)
/vendors/$id       Vendor detail page (also reachable via modal)
/leads             Inbound Leads tab
/import            Import / Export panel
```

Top nav (shared on all routes): Saffron Events wordmark (gold on charcoal), global search, "Add Vendor" CTA, stats strip (Total vendors · # categories · Last added).

### Dashboard layout (`/`)

**Left sidebar**
- "All" + 14 categories with live count badges
- Location multi-select chips: Delhi, Gurugram, Noida, Pan India, Rajasthan, Other
- Source filter: Manual Entry / Inbound Form / RFP Response / Reference / Sample Data
- Tags filter (chips, derived from existing tags)
- Collapsible on tablet

**Main area**
- View toggle: Card view (default) / Table view
- Card: name, color-coded category badge, location, click-to-copy phone, IG handle linking to instagram.com/[handle], price range (₹X – ₹Y), star rating, tag chips, View Details + Edit
- Table: sortable Name / Category / Location / Price Low / Price High / Rating / Date Added; inline edit pencil
- Empty state per category: "No vendors in this category yet. Add one →"

### Vendor detail modal

Full record + Commission, Portfolio, Remarks. Buttons: Edit, Delete (with confirm), **Copy Contact Card** (writes formatted text to clipboard: `Name | Category | Phone | Instagram | Website | Price Range`).

### Add / Edit vendor modal

Single form covering all fields. Category dropdown dynamically reveals:
- Hotels & Venues → number of rooms, distance from Delhi, hotel category (Budget / Mid-Range / Upper Mid / Luxury / Ultra-Luxury)
- Photography & Videography → quote breakdown, team size, deliverables (RFP block)

Validation: vendor name + category required. Saves to Postgres, list refreshes instantly.

### Inbound Leads tab (`/leads`)

Table of submissions with timestamp, name, services, location, contact, IG, email, portfolio. Filters: date range + services keyword. Each row has **Convert to Vendor** → opens Add Vendor modal pre-filled, marks lead as converted on save.

(Leads can be seeded with sample rows; a public submission endpoint can be added later if you want a real intake form.)

### Import / Export panel (`/import`)

- Export All to CSV
- Export by Category (dropdown + button)
- Import from CSV: drag-drop or paste area
- Paste from Google Sheets: textarea for tab-separated rows
- **Smart auto-mapping**: detects common header variants (Name/Vendor/Vendor Name, Phone/Contact/Mobile, IG/Instagram/Insta, Price/Budget, etc.) and shows a preview table with detected → target column mapping before commit
- Duplicate check on `vendor_name + contact_number`; duplicates flagged and skipped (with count shown)

### Seed data

3–4 realistic Delhi-NCR vendors per category (~50 total) inserted on first run, all tagged `sample` with `source = "Sample Data"` so you can bulk-delete later via a "Clear sample data" button in the import panel.

### Categories (final list)

13 from spec + a 14th — please confirm which to add (suggestions: Mehendi Artists, Florists, Invitations & Stationery, Wedding Attire). I'll default to **Mehendi Artists** unless you say otherwise.

### Technical notes

- TanStack Start + Lovable Cloud (Postgres via Supabase). Reads/writes go through `createServerFn` using `requireSupabaseAuth`-free open client for now (RLS open policies).
- React Query for caching + optimistic updates on add/edit/delete.
- CSV parsing with PapaParse; clipboard via `navigator.clipboard`.
- All filters/search are client-side over the loaded vendor list (fine for 500–2000 rows).
