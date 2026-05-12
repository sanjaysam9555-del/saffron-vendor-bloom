CREATE TABLE public.instagram_backfill_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by uuid,
  status text NOT NULL DEFAULT 'running',
  total int NOT NULL DEFAULT 0,
  processed int NOT NULL DEFAULT 0,
  ok int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0,
  pending_vendor_ids uuid[] NOT NULL DEFAULT '{}',
  last_error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_backfill_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage instagram backfill jobs"
ON public.instagram_backfill_jobs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE TRIGGER trg_instagram_backfill_jobs_updated_at
BEFORE UPDATE ON public.instagram_backfill_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();