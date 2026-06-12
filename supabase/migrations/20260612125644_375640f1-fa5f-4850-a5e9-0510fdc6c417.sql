ALTER TABLE public.project_other_expenses
  ADD COLUMN IF NOT EXISTS criticality text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS booked boolean NOT NULL DEFAULT true;

ALTER TABLE public.project_other_expenses
  DROP CONSTRAINT IF EXISTS project_other_expenses_criticality_check;
ALTER TABLE public.project_other_expenses
  ADD CONSTRAINT project_other_expenses_criticality_check
  CHECK (criticality IN ('low','medium','high'));