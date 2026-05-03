ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS saffron_rating numeric(2,1);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_saffron_rating_range') THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT vendors_saffron_rating_range
      CHECK (saffron_rating IS NULL OR (saffron_rating >= 0 AND saffron_rating <= 5));
  END IF;
END $$;