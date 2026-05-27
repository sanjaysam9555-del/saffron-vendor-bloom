ALTER TABLE public.project_category_deadlines
  ADD COLUMN IF NOT EXISTS planned_amount numeric,
  ADD COLUMN IF NOT EXISTS actual_amount_override numeric;