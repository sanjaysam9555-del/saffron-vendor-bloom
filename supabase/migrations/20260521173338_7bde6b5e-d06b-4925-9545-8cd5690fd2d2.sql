-- Indexes to speed up vendor list queries and search.
CREATE INDEX IF NOT EXISTS vendors_date_added_id_idx
  ON public.vendors (date_added DESC, id);

CREATE INDEX IF NOT EXISTS vendors_vendor_name_trgm_idx
  ON public.vendors (lower(vendor_name) text_pattern_ops);

CREATE INDEX IF NOT EXISTS vendors_category_idx
  ON public.vendors (category);

CREATE INDEX IF NOT EXISTS vendors_location_idx
  ON public.vendors (location);