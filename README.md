# Saffron Planning Studio

Build me a fully functional Vendor Management Dashboard as a React artifact for Saffron Events, a premium wedding planning company based in Gurugram, India. Use persistent storage (window.storage) so data survives across sessions.

---

CONTEXT & PURPOSE:

We currently manage ~500+ vendors across 14 categories in a messy Google Sheet with inconsistent columns and no unified view. This dashboard should replace the manual sheet-browsing experience and let us add, search, filter, and view vendors cleanly.

---

VENDOR CATEGORIES (tabs/sections in the dashboard):

1. Photography & Videography

2. Decor

3. Catering

4. Sound & Lighting

5. Production & Event Management

6. Special Effects (SFX)

7. Makeup Artists

8. Hospitality & Manpower

9. Anchors & Emcees

10. Car Rental & Transport

11. Hotels & Venues

12. DJs & Live Music

13. Miscellaneous

---

UNIFIED VENDOR DATA SCHEMA (fields for every vendor):

- id (auto-generated)

- vendorName (string, required)

- category (dropdown from the 13 above, required)

- subcategory (optional free text e.g. "Candid Photography", "Bridal Makeup")

- location (string — city/area e.g. "Gurugram", "South Delhi", "Noida")

- contactNumber (string)

- email (string)

- instagramHandle (string — just the handle, no full URL needed)

- website (string)

- googleRating (number 0–5, optional)

- priceRangeLow (number in ₹, optional)

- priceRangeHigh (number in ₹, optional)

- commissionModel (string — e.g. "15%", "Included in quote", "On discussion")

- portfolioLink (string, optional)

- source (dropdown: "Manual Entry" | "Inbound Form" | "RFP Response" | "Reference")

- remarks (long text, optional)

- dateAdded (auto timestamp)

- tags (comma-separated free text e.g. "premium", "budget", "shortlisted", "blacklisted")

For Hotels/Venues category, also show: numberOfRooms, distanceFromDelhi, hotelCategory (Budget / Mid-Range / Upper Mid / Luxury / Ultra-Luxury)

For Photography RFP tab, also show: quoteBreakdown (text), teamSize (text), deliverables (text)

---

DASHBOARD LAYOUT & FEATURES:

1. TOP NAVIGATION BAR

- Saffron Events logo text (gold on dark)

- Search bar (searches across vendorName, location, instagramHandle, remarks)

- "Add Vendor" button (opens modal)

- Stats strip: Total vendors | # categories | Last added

2. LEFT SIDEBAR — Category Filter

- All (default)

- List of all 13 categories with vendor count badges

- Location filter (multi-select chips: Delhi, Gurugram, Noida, Pan India, Rajasthan, Other)

- Source filter (Manual / Form / RFP)

- Tags filter

3. MAIN VENDOR GRID (card view by default, toggle to table view)

Card view:

- Vendor name (bold)

- Category badge (color-coded per category)

- Location

- Contact number (click to copy)

- Instagram handle (click opens instagram.com/[handle])

- Price range (if available, formatted as ₹X – ₹Y or ₹XL)

- Rating stars (if available)

- Tags as chips

- "View Details" and "Edit" buttons

Table view:

- Sortable columns: Name, Category, Location, Price Low, Price High, Rating, Date Added

- Inline edit option

4. VENDOR DETAIL MODAL (click View Details)

- Full card with all fields

- Commission model, portfolio link, remarks

- Edit button

- Delete button (with confirmation)

- "Copy Contact Card" button (copies formatted text: Name | Category | Phone | Instagram | Website | Price Range)

5. ADD / EDIT VENDOR MODAL

- Form with all fields from the schema above

- Category dropdown auto-adjusts visible fields (e.g. hotels show extra fields)

- Validation: vendorName and category are required

- Save stores to window.storage

6. IMPORT / EXPORT PANEL (collapsible section at bottom)

- Export All to CSV button (downloads CSV of all vendors)

- Export by Category dropdown + Export button

- Import from CSV: drag-drop or paste area — parses CSV and bulk-adds vendors (with duplicate check on vendorName + contactNumber)

- "Paste from Google Sheets" text area: user pastes tab-separated rows, system parses and maps columns

7. INBOUND FORM RESPONSES TAB

- Separate tab called "Inbound Leads"

- Shows entries with: Timestamp, Name, Services, Location, Contact, Instagram, Email, Portfolio

- Each row has "Convert to Vendor" button — opens Add Vendor modal pre-filled with parsed data

- Filter by date range and services keyword

---

DESIGN SYSTEM:

- Color palette: Deep charcoal (#1A1A1A) background, Gold (#C9A84C) as primary accent, White (#FFFFFF) for text, Soft cream (#F5F0E8) for card backgrounds

- Typography: Use Google Fonts — Cormorant Garamond for headings, Inter for body text

- Cards: Rounded corners (12px), subtle gold border on hover, shadow on hover

- Category badge colors: each category gets a distinct muted color (not all gold)

- Responsive: works on desktop and tablet

- Micro-interactions: smooth transitions on modal open/close, hover states on cards

---

SAMPLE SEED DATA (pre-load 3–4 vendors per category so the dashboard isn't empty):

Include realistic Indian wedding vendor names, Delhi NCR locations, and INR price ranges as placeholder seed data. Mark them with source: "Sample Data" and a tag "sample" so users can delete them later.

---

TECHNICAL NOTES:

- Use React with hooks (useState, useEffect, useCallback)

- Use window.storage API for persistence (get, set, list, delete) — wrap in try/catch

- Load data on mount, save on every add/edit/delete

- Use Tailwind utility classes for styling

- Import Lucide icons for UI elements

- No external API calls needed — this is fully offline/local

- Handle empty states gracefully (e.g. "No vendors in this category yet. Add one →")

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://saffron-vendor-bloom.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d7328052-e869-41c3-81e8-267167087b2a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
