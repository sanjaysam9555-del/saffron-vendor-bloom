INSERT INTO public.categories (name, is_base, is_deleted)
SELECT DISTINCT trim(category), false, false
FROM public.vendors
WHERE category IS NOT NULL
  AND trim(category) <> ''
ON CONFLICT (name) DO UPDATE
SET is_deleted = false,
    updated_at = now();