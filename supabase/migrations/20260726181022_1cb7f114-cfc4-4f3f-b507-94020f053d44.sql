
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS planning_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.admin_payments_matrix(date, date);

CREATE OR REPLACE FUNCTION public.admin_payments_matrix(_from date, _to date)
RETURNS TABLE(
  project_id uuid,
  bride_name text,
  groom_name text,
  wedding_date date,
  total_installments smallint,
  planning_fee numeric,
  total_received numeric,
  payment_remarks text,
  installments jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  WITH inst AS (
    SELECT pp.project_id AS pid,
      SUM(COALESCE(pp.received_amount, 0))::numeric AS received_sum,
      jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'installment_no', pp.installment_no,
          'expected_amount', pp.expected_amount,
          'received_amount', pp.received_amount,
          'received_on', pp.received_on,
          'status', pp.status
        ) ORDER BY pp.installment_no NULLS LAST
      ) AS items
    FROM public.project_payments pp
    GROUP BY pp.project_id
  )
  SELECT p.id, p.bride_name, p.groom_name, p.wedding_date,
    p.total_installments,
    COALESCE(p.planning_fee, 0),
    COALESCE(inst.received_sum, 0),
    p.payment_remarks,
    COALESCE(inst.items, '[]'::jsonb)
  FROM public.projects p
  LEFT JOIN inst ON inst.pid = p.id
  WHERE (_from IS NULL OR p.wedding_date >= _from)
    AND (_to   IS NULL OR p.wedding_date <= _to)
  ORDER BY p.wedding_date DESC NULLS LAST;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_payments_matrix(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payments_matrix(date, date) TO authenticated;
