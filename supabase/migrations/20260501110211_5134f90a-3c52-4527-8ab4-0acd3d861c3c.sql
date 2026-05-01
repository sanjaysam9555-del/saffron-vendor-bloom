ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS submitted_via_form boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vendors_submitted_via_form
  ON public.vendors (submitted_via_form)
  WHERE submitted_via_form = true;