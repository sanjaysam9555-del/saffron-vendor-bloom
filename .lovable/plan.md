## Goal
Remove the vendor's intrinsic price (`price_text`) from anything a client can see. Clients should only see quote amounts that the admin explicitly adds via the quotes flow. Admin views remain unchanged.

## Changes

1. **`src/components/client/ClientVendorDetail.tsx`**
   - Remove the `<Row label="Price" value={vendor.price_text} />` from the details grid.

2. **`src/components/client/ClientVendorCard.tsx`**
   - Remove the `vendor.price_text` block (the terracotta price line under the contact details).

## Out of scope
- Admin views (`admin.projects.$id.tsx`, vendor management, etc.) keep showing `price_text`.
- The `price_text` field stays on the vendor record and in the API — just not rendered to clients.
- Quote pill / quote panel on the client side stays exactly as-is (that's the admin-added quote, which the user explicitly wants visible).
