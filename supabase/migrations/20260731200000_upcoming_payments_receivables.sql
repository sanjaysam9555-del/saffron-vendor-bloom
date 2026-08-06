
-- 1. Add due_date to vendor_payment_installments
ALTER TABLE public.vendor_payment_installments
  ADD COLUMN IF NOT EXISTS due_date date;

-- 2. RPC: upcoming receivables (pending/partial/overdue client payments)
CREATE OR REPLACE FUNCTION public.admin_upcoming_receivables()
RETURNS TABLE(
  project_id uuid,
  bride_name text,
  groom_name text,
  installment_no smallint,
  expected_amount numeric,
  received_amount numeric,
  due_date date,
  status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  SELECT
    p.id         AS project_id,
    p.bride_name,
    p.groom_name,
    pp.installment_no,
    pp.expected_amount,
    pp.received_amount,
    pp.due_date,
    pp.status::text
  FROM public.project_payments pp
  JOIN public.projects p ON p.id = pp.project_id
  WHERE pp.status IN ('pending', 'partial', 'overdue')
    AND p.archived_at IS NULL
  ORDER BY pp.due_date ASC NULLS LAST, p.wedding_date ASC NULLS LAST;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_upcoming_receivables() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upcoming_receivables() TO authenticated;

-- 3. RPC: upcoming vendor payments (pending/partial/overdue outgoing payments)
CREATE OR REPLACE FUNCTION public.admin_upcoming_payments()
RETURNS TABLE(
  project_id uuid,
  bride_name text,
  groom_name text,
  vendor_id uuid,
  vendor_name text,
  installment_no smallint,
  expected_amount numeric,
  paid_amount numeric,
  due_date date,
  paid_by text,
  status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  SELECT
    vpi.project_id,
    p.bride_name,
    p.groom_name,
    vpi.vendor_id,
    v.vendor_name,
    vpi.installment_no,
    vpi.expected_amount,
    vpi.paid_amount,
    vpi.due_date,
    vpi.paid_by,
    vpi.status::text
  FROM public.vendor_payment_installments vpi
  JOIN public.projects p ON p.id = vpi.project_id
  JOIN public.vendors v ON v.id = vpi.vendor_id
  WHERE vpi.status IN ('pending', 'partial', 'overdue')
    AND p.archived_at IS NULL
  ORDER BY vpi.due_date ASC NULLS LAST, p.wedding_date ASC NULLS LAST;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_upcoming_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upcoming_payments() TO authenticated;
