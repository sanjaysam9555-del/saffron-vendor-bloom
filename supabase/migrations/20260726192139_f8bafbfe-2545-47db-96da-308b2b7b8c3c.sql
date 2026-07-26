
-- 1. New table: vendor_commission_payments -----------------------------------
CREATE TABLE public.vendor_commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.project_vendor_quotes(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  installment_no smallint NOT NULL CHECK (installment_no BETWEEN 1 AND 4),
  expected_amount numeric NOT NULL DEFAULT 0,
  received_amount numeric NOT NULL DEFAULT 0,
  received_on date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','received','overdue')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, installment_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_commission_payments TO authenticated;
GRANT ALL ON public.vendor_commission_payments TO service_role;

ALTER TABLE public.vendor_commission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vendor commission payments"
  ON public.vendor_commission_payments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_vendor_commission_payments
BEFORE UPDATE ON public.vendor_commission_payments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Extend project_vendor_quotes -------------------------------------------
ALTER TABLE public.project_vendor_quotes
  ADD COLUMN IF NOT EXISTS total_commission_installments smallint NOT NULL DEFAULT 2 CHECK (total_commission_installments BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS commission_remarks text;

-- 3. RPC: per-project analytics overview ------------------------------------
CREATE OR REPLACE FUNCTION public.admin_project_analytics_overview(_project_id uuid)
RETURNS TABLE(client_billing numeric, vendor_cost numeric, commission numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  WITH q AS (
    SELECT COALESCE(pvq.closed_amount, pvq.quote_amount, 0)::numeric AS client_amount,
           COALESCE(c.commission_amount, 0)::numeric AS commission_amount
    FROM public.project_vendor_quotes pvq
    LEFT JOIN public.project_quote_commissions c ON c.quote_id = pvq.id
    WHERE pvq.project_id = _project_id
      AND (pvq.is_final = TRUE OR pvq.status = 'closed')
  )
  SELECT
    COALESCE(SUM(client_amount), 0),
    COALESCE(SUM(client_amount - commission_amount), 0),
    COALESCE(SUM(commission_amount), 0)
  FROM q;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_project_analytics_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_project_analytics_overview(uuid) TO authenticated;

-- 4. RPC: per-project P&L (per closed vendor) -------------------------------
CREATE OR REPLACE FUNCTION public.admin_project_pnl(_project_id uuid)
RETURNS TABLE(quote_id uuid, vendor_id uuid, vendor_name text, category text, client_billing numeric, vendor_cost numeric, commission numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  SELECT pvq.id AS quote_id,
         v.id AS vendor_id,
         v.vendor_name,
         v.category,
         COALESCE(pvq.closed_amount, pvq.quote_amount, 0)::numeric AS client_billing,
         (COALESCE(pvq.closed_amount, pvq.quote_amount, 0) - COALESCE(c.commission_amount, 0))::numeric AS vendor_cost,
         COALESCE(c.commission_amount, 0)::numeric AS commission
  FROM public.project_vendor_quotes pvq
  JOIN public.vendors v ON v.id = pvq.vendor_id
  LEFT JOIN public.project_quote_commissions c ON c.quote_id = pvq.id
  WHERE pvq.project_id = _project_id
    AND (pvq.is_final = TRUE OR pvq.status = 'closed')
  ORDER BY v.vendor_name;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_project_pnl(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_project_pnl(uuid) TO authenticated;

-- 5. RPC: per-project vendor commission matrix ------------------------------
CREATE OR REPLACE FUNCTION public.admin_project_commission_matrix(_project_id uuid)
RETURNS TABLE(
  quote_id uuid,
  vendor_id uuid,
  vendor_name text,
  category text,
  closed_amount numeric,
  commission_amount numeric,
  total_installments smallint,
  commission_remarks text,
  total_received numeric,
  installments jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  WITH inst AS (
    SELECT vcp.quote_id AS qid,
      SUM(COALESCE(vcp.received_amount, 0))::numeric AS received_sum,
      jsonb_agg(
        jsonb_build_object(
          'id', vcp.id,
          'installment_no', vcp.installment_no,
          'expected_amount', vcp.expected_amount,
          'received_amount', vcp.received_amount,
          'received_on', vcp.received_on,
          'status', vcp.status
        ) ORDER BY vcp.installment_no NULLS LAST
      ) AS items
    FROM public.vendor_commission_payments vcp
    GROUP BY vcp.quote_id
  )
  SELECT pvq.id AS quote_id,
         v.id AS vendor_id,
         v.vendor_name,
         v.category,
         COALESCE(pvq.closed_amount, pvq.quote_amount, 0)::numeric AS closed_amount,
         COALESCE(c.commission_amount, 0)::numeric AS commission_amount,
         pvq.total_commission_installments,
         pvq.commission_remarks,
         COALESCE(inst.received_sum, 0)::numeric AS total_received,
         COALESCE(inst.items, '[]'::jsonb) AS installments
  FROM public.project_vendor_quotes pvq
  JOIN public.vendors v ON v.id = pvq.vendor_id
  LEFT JOIN public.project_quote_commissions c ON c.quote_id = pvq.id
  LEFT JOIN inst ON inst.qid = pvq.id
  WHERE pvq.project_id = _project_id
    AND (pvq.is_final = TRUE OR pvq.status = 'closed')
  ORDER BY v.vendor_name;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_project_commission_matrix(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_project_commission_matrix(uuid) TO authenticated;
