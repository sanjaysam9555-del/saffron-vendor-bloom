
-- 1. New table: vendor_payment_installments -----------------------------------
CREATE TABLE public.vendor_payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.project_vendor_quotes(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  installment_no smallint NOT NULL CHECK (installment_no BETWEEN 1 AND 4),
  expected_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  paid_on date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','overdue')),
  paid_by text NOT NULL DEFAULT 'planner' CHECK (paid_by IN ('planner','client')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, installment_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_payment_installments TO authenticated;
GRANT ALL ON public.vendor_payment_installments TO service_role;

ALTER TABLE public.vendor_payment_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vendor payment installments"
  ON public.vendor_payment_installments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_vendor_payment_installments
BEFORE UPDATE ON public.vendor_payment_installments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Extend project_vendor_quotes -------------------------------------------
ALTER TABLE public.project_vendor_quotes
  ADD COLUMN IF NOT EXISTS total_vendor_payment_installments smallint NOT NULL DEFAULT 1 CHECK (total_vendor_payment_installments BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS vendor_payment_remarks text;

-- 3. RPC: per-project vendor payment matrix ----------------------------------
CREATE OR REPLACE FUNCTION public.admin_project_vendor_payment_matrix(_project_id uuid)
RETURNS TABLE(
  quote_id uuid,
  vendor_id uuid,
  vendor_name text,
  category text,
  vendor_cost numeric,
  total_installments smallint,
  payment_remarks text,
  total_paid numeric,
  installments jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  WITH inst AS (
    SELECT vpi.quote_id AS qid,
      SUM(COALESCE(vpi.paid_amount, 0))::numeric AS paid_sum,
      jsonb_agg(
        jsonb_build_object(
          'id', vpi.id,
          'installment_no', vpi.installment_no,
          'expected_amount', vpi.expected_amount,
          'paid_amount', vpi.paid_amount,
          'paid_on', vpi.paid_on,
          'status', vpi.status,
          'paid_by', vpi.paid_by
        ) ORDER BY vpi.installment_no NULLS LAST
      ) AS items
    FROM public.vendor_payment_installments vpi
    GROUP BY vpi.quote_id
  )
  SELECT pvq.id AS quote_id,
         v.id AS vendor_id,
         v.vendor_name,
         v.category,
         (COALESCE(pvq.closed_amount, pvq.quote_amount, 0) - COALESCE(c.commission_amount, 0))::numeric AS vendor_cost,
         pvq.total_vendor_payment_installments,
         pvq.vendor_payment_remarks,
         COALESCE(inst.paid_sum, 0)::numeric AS total_paid,
         COALESCE(inst.items, '[]'::jsonb) AS installments
  FROM public.project_vendor_quotes pvq
  JOIN public.vendors v ON v.id = pvq.vendor_id
  LEFT JOIN public.project_quote_commissions c ON c.quote_id = pvq.id
  LEFT JOIN inst ON inst.qid = pvq.id
  WHERE pvq.project_id = _project_id
    AND (pvq.is_final = TRUE OR pvq.status = 'closed')
  ORDER BY v.vendor_name;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_project_vendor_payment_matrix(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_project_vendor_payment_matrix(uuid) TO authenticated;
