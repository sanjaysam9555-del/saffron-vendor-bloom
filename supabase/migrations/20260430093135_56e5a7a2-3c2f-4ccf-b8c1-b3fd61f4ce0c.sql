ALTER TABLE public.vendors DROP COLUMN IF EXISTS price_range_low;
ALTER TABLE public.vendors DROP COLUMN IF EXISTS price_range_high;
ALTER TABLE public.vendors DROP COLUMN IF EXISTS tags;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS price_text text;