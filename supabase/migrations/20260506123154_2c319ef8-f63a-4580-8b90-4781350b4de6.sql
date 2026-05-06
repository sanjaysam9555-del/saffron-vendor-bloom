
-- Quote status enum
CREATE TYPE public.quote_status AS ENUM ('received', 'revised', 'closed', 'withdrawn');

-- project_vendor_quotes
CREATE TABLE public.project_vendor_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category TEXT,
  quote_text TEXT,
  quote_amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'INR',
  status public.quote_status NOT NULL DEFAULT 'received',
  is_final BOOLEAN NOT NULL DEFAULT false,
  closed_amount NUMERIC,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pvq_project ON public.project_vendor_quotes(project_id);
CREATE INDEX idx_pvq_vendor ON public.project_vendor_quotes(vendor_id);
CREATE INDEX idx_pvq_project_vendor ON public.project_vendor_quotes(project_id, vendor_id);

ALTER TABLE public.project_vendor_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage project vendor quotes"
ON public.project_vendor_quotes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Clients view their project quotes"
ON public.project_vendor_quotes FOR SELECT TO authenticated
USING (has_project_access(auth.uid(), project_id));

-- updated_at trigger
CREATE TRIGGER trg_pvq_updated_at
BEFORE UPDATE ON public.project_vendor_quotes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger: only one is_final per (project, vendor)
CREATE OR REPLACE FUNCTION public.enforce_single_final_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' THEN
    NEW.is_final = true;
  END IF;
  IF NEW.is_final = true THEN
    UPDATE public.project_vendor_quotes
    SET is_final = false
    WHERE project_id = NEW.project_id
      AND vendor_id = NEW.vendor_id
      AND id <> NEW.id
      AND is_final = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pvq_single_final
BEFORE INSERT OR UPDATE ON public.project_vendor_quotes
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_final_quote();

-- project_vendor_quote_files
CREATE TABLE public.project_vendor_quote_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.project_vendor_quotes(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pvqf_quote ON public.project_vendor_quote_files(quote_id);

ALTER TABLE public.project_vendor_quote_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage quote files"
ON public.project_vendor_quote_files FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Clients view their project quote files"
ON public.project_vendor_quote_files FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_vendor_quotes q
    WHERE q.id = project_vendor_quote_files.quote_id
      AND has_project_access(auth.uid(), q.project_id)
  )
);

-- vendor_booked_summary view
CREATE OR REPLACE VIEW public.vendor_booked_summary
WITH (security_invoker = true)
AS
SELECT
  vendor_id,
  COUNT(DISTINCT project_id) AS times_booked,
  MAX(updated_at) AS last_booked_at,
  (ARRAY_AGG(closed_amount ORDER BY updated_at DESC))[1] AS last_closed_amount,
  (ARRAY_AGG(project_id ORDER BY updated_at DESC))[1] AS last_project_id
FROM public.project_vendor_quotes
WHERE status = 'closed'
GROUP BY vendor_id;
