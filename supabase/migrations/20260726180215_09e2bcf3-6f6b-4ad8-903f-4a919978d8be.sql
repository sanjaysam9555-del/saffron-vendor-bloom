
-- 1. Projects: total_installments + payment_remarks
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS total_installments SMALLINT NOT NULL DEFAULT 1
    CHECK (total_installments BETWEEN 1 AND 4);
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS payment_remarks TEXT;

-- 2. Project payments: installment_no
ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS installment_no SMALLINT;

-- Backfill installment_no for existing rows (order by due_date, created_at)
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY due_date NULLS LAST, created_at) AS rn
  FROM public.project_payments
  WHERE installment_no IS NULL
)
UPDATE public.project_payments p
SET installment_no = LEAST(numbered.rn, 4)::smallint
FROM numbered
WHERE p.id = numbered.id;

-- Set total_installments for existing projects based on existing payment rows
UPDATE public.projects p
SET total_installments = LEAST(GREATEST(sub.cnt, 1), 4)::smallint
FROM (
  SELECT project_id, COUNT(*)::int AS cnt
  FROM public.project_payments
  GROUP BY project_id
) sub
WHERE sub.project_id = p.id;

-- Unique (project_id, installment_no) — allow nulls just in case
CREATE UNIQUE INDEX IF NOT EXISTS project_payments_project_installment_unique
  ON public.project_payments (project_id, installment_no)
  WHERE installment_no IS NOT NULL;

-- 3. Admin payments matrix RPC
CREATE OR REPLACE FUNCTION public.admin_payments_matrix(_from date, _to date)
RETURNS TABLE(
  project_id uuid,
  bride_name text,
  groom_name text,
  wedding_date date,
  total_installments smallint,
  closed_amount numeric,
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
  WITH closed AS (
    SELECT q.project_id AS pid,
      SUM(COALESCE(q.closed_amount, q.quote_amount, 0))::numeric AS billing
    FROM public.project_vendor_quotes q
    WHERE q.is_final = TRUE OR q.status = 'closed'
    GROUP BY q.project_id
  ),
  inst AS (
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
    COALESCE(closed.billing, 0),
    COALESCE(inst.received_sum, 0),
    p.payment_remarks,
    COALESCE(inst.items, '[]'::jsonb)
  FROM public.projects p
  LEFT JOIN closed ON closed.pid = p.id
  LEFT JOIN inst ON inst.pid = p.id
  WHERE (_from IS NULL OR p.wedding_date >= _from)
    AND (_to   IS NULL OR p.wedding_date <= _to)
  ORDER BY p.wedding_date DESC NULLS LAST;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_payments_matrix(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payments_matrix(date, date) TO authenticated;
