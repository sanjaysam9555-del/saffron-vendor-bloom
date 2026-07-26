-- 1) Commission per closed quote (admin-only)
CREATE TABLE public.project_quote_commissions (
  quote_id UUID PRIMARY KEY REFERENCES public.project_vendor_quotes(id) ON DELETE CASCADE,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_quote_commissions TO authenticated;
GRANT ALL ON public.project_quote_commissions TO service_role;
ALTER TABLE public.project_quote_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_commissions_admin_all" ON public.project_quote_commissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER project_quote_commissions_touch
  BEFORE UPDATE ON public.project_quote_commissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Project payment ledger (admin-only)
CREATE TYPE public.project_payment_status AS ENUM ('pending','partial','received','overdue');

CREATE TABLE public.project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  expected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  received_on DATE,
  status public.project_payment_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_payments_project_idx ON public.project_payments(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_payments TO authenticated;
GRANT ALL ON public.project_payments TO service_role;
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_payments_admin_all" ON public.project_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER project_payments_touch
  BEFORE UPDATE ON public.project_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Admin-only analytics RPCs
CREATE OR REPLACE FUNCTION public.admin_analytics_overview(_from DATE, _to DATE)
RETURNS TABLE (
  client_billing NUMERIC,
  vendor_cost NUMERIC,
  commission NUMERIC,
  received NUMERIC,
  pending NUMERIC,
  project_count BIGINT,
  booked_vendor_count BIGINT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  WITH quotes AS (
    SELECT q.project_id, q.vendor_id, COALESCE(q.closed_amount, q.quote_amount, 0)::numeric AS client_amount,
           COALESCE(c.commission_amount, 0)::numeric AS commission_amount
    FROM public.project_vendor_quotes q
    LEFT JOIN public.project_quote_commissions c ON c.quote_id = q.id
    JOIN public.projects p ON p.id = q.project_id
    WHERE (q.is_final = TRUE OR q.status = 'closed')
      AND (_from IS NULL OR p.wedding_date >= _from)
      AND (_to   IS NULL OR p.wedding_date <= _to)
  ),
  pay AS (
    SELECT pp.project_id, COALESCE(SUM(pp.expected_amount),0)::numeric AS expected,
           COALESCE(SUM(pp.received_amount),0)::numeric AS received
    FROM public.project_payments pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE (_from IS NULL OR p.wedding_date >= _from)
      AND (_to   IS NULL OR p.wedding_date <= _to)
    GROUP BY pp.project_id
  )
  SELECT
    COALESCE(SUM(q.client_amount),0),
    COALESCE(SUM(q.client_amount - q.commission_amount),0),
    COALESCE(SUM(q.commission_amount),0),
    COALESCE((SELECT SUM(received) FROM pay),0),
    GREATEST(COALESCE((SELECT SUM(expected) FROM pay),0) - COALESCE((SELECT SUM(received) FROM pay),0), 0),
    (SELECT COUNT(DISTINCT project_id) FROM quotes),
    (SELECT COUNT(DISTINCT vendor_id)  FROM quotes)
  FROM quotes q;
END;$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_projects(_from DATE, _to DATE)
RETURNS TABLE (
  project_id UUID,
  bride_name TEXT,
  groom_name TEXT,
  wedding_date DATE,
  client_billing NUMERIC,
  vendor_cost NUMERIC,
  commission NUMERIC,
  received NUMERIC,
  pending NUMERIC,
  vendor_count BIGINT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  WITH q AS (
    SELECT q.project_id,
           SUM(COALESCE(q.closed_amount, q.quote_amount, 0))::numeric AS billing,
           SUM(COALESCE(c.commission_amount, 0))::numeric AS commission,
           COUNT(DISTINCT q.vendor_id) AS vendors
    FROM public.project_vendor_quotes q
    LEFT JOIN public.project_quote_commissions c ON c.quote_id = q.id
    WHERE (q.is_final = TRUE OR q.status = 'closed')
    GROUP BY q.project_id
  ),
  pay AS (
    SELECT project_id,
           COALESCE(SUM(expected_amount),0)::numeric AS expected,
           COALESCE(SUM(received_amount),0)::numeric AS received
    FROM public.project_payments GROUP BY project_id
  )
  SELECT p.id, p.bride_name, p.groom_name, p.wedding_date,
         COALESCE(q.billing,0),
         COALESCE(q.billing,0) - COALESCE(q.commission,0),
         COALESCE(q.commission,0),
         COALESCE(pay.received,0),
         GREATEST(COALESCE(pay.expected,0) - COALESCE(pay.received,0), 0),
         COALESCE(q.vendors,0)
  FROM public.projects p
  LEFT JOIN q ON q.project_id = p.id
  LEFT JOIN pay ON pay.project_id = p.id
  WHERE (_from IS NULL OR p.wedding_date >= _from)
    AND (_to   IS NULL OR p.wedding_date <= _to)
  ORDER BY p.wedding_date DESC NULLS LAST;
END;$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_vendors(_from DATE, _to DATE)
RETURNS TABLE (
  vendor_id UUID,
  vendor_name TEXT,
  category TEXT,
  bookings BIGINT,
  client_billing NUMERIC,
  commission NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  SELECT v.id, v.vendor_name, v.category,
         COUNT(DISTINCT q.project_id) AS bookings,
         SUM(COALESCE(q.closed_amount, q.quote_amount, 0))::numeric AS client_billing,
         SUM(COALESCE(c.commission_amount, 0))::numeric AS commission
  FROM public.project_vendor_quotes q
  JOIN public.projects p ON p.id = q.project_id
  JOIN public.vendors v ON v.id = q.vendor_id
  LEFT JOIN public.project_quote_commissions c ON c.quote_id = q.id
  WHERE (q.is_final = TRUE OR q.status = 'closed')
    AND (_from IS NULL OR p.wedding_date >= _from)
    AND (_to   IS NULL OR p.wedding_date <= _to)
  GROUP BY v.id, v.vendor_name, v.category
  ORDER BY commission DESC NULLS LAST, client_billing DESC NULLS LAST;
END;$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_categories(_from DATE, _to DATE)
RETURNS TABLE (
  category TEXT,
  bookings BIGINT,
  client_billing NUMERIC,
  commission NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
  SELECT COALESCE(v.category,'Uncategorised') AS category,
         COUNT(*) AS bookings,
         SUM(COALESCE(q.closed_amount, q.quote_amount, 0))::numeric AS client_billing,
         SUM(COALESCE(c.commission_amount, 0))::numeric AS commission
  FROM public.project_vendor_quotes q
  JOIN public.projects p ON p.id = q.project_id
  JOIN public.vendors v ON v.id = q.vendor_id
  LEFT JOIN public.project_quote_commissions c ON c.quote_id = q.id
  WHERE (q.is_final = TRUE OR q.status = 'closed')
    AND (_from IS NULL OR p.wedding_date >= _from)
    AND (_to   IS NULL OR p.wedding_date <= _to)
  GROUP BY COALESCE(v.category,'Uncategorised')
  ORDER BY client_billing DESC NULLS LAST;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_analytics_overview(DATE,DATE)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_analytics_projects(DATE,DATE)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_analytics_vendors(DATE,DATE)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_analytics_categories(DATE,DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_overview(DATE,DATE)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_projects(DATE,DATE)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_vendors(DATE,DATE)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_categories(DATE,DATE) TO authenticated;
