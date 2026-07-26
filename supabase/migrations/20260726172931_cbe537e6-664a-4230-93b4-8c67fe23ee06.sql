
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
    SELECT q.project_id AS pid, q.vendor_id AS vid,
           COALESCE(q.closed_amount, q.quote_amount, 0)::numeric AS client_amount,
           COALESCE(c.commission_amount, 0)::numeric AS commission_amount
    FROM public.project_vendor_quotes q
    LEFT JOIN public.project_quote_commissions c ON c.quote_id = q.id
    JOIN public.projects p ON p.id = q.project_id
    WHERE (q.is_final = TRUE OR q.status = 'closed')
      AND (_from IS NULL OR p.wedding_date >= _from)
      AND (_to   IS NULL OR p.wedding_date <= _to)
  ),
  pay AS (
    SELECT pp.project_id AS pid,
           COALESCE(SUM(pp.expected_amount),0)::numeric AS expected_sum,
           COALESCE(SUM(pp.received_amount),0)::numeric AS received_sum
    FROM public.project_payments pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE (_from IS NULL OR p.wedding_date >= _from)
      AND (_to   IS NULL OR p.wedding_date <= _to)
    GROUP BY pp.project_id
  )
  SELECT
    COALESCE(SUM(qq.client_amount),0),
    COALESCE(SUM(qq.client_amount - qq.commission_amount),0),
    COALESCE(SUM(qq.commission_amount),0),
    COALESCE((SELECT SUM(received_sum) FROM pay),0),
    GREATEST(COALESCE((SELECT SUM(expected_sum) FROM pay),0) - COALESCE((SELECT SUM(received_sum) FROM pay),0), 0),
    (SELECT COUNT(DISTINCT pid) FROM quotes),
    (SELECT COUNT(DISTINCT vid) FROM quotes)
  FROM quotes qq;
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
    SELECT pvq.project_id AS pid,
           SUM(COALESCE(pvq.closed_amount, pvq.quote_amount, 0))::numeric AS billing,
           SUM(COALESCE(c.commission_amount, 0))::numeric AS commission_sum,
           COUNT(DISTINCT pvq.vendor_id) AS vendors
    FROM public.project_vendor_quotes pvq
    LEFT JOIN public.project_quote_commissions c ON c.quote_id = pvq.id
    WHERE (pvq.is_final = TRUE OR pvq.status = 'closed')
    GROUP BY pvq.project_id
  ),
  pay AS (
    SELECT pp.project_id AS pid,
           COALESCE(SUM(pp.expected_amount),0)::numeric AS expected_sum,
           COALESCE(SUM(pp.received_amount),0)::numeric AS received_sum
    FROM public.project_payments pp
    GROUP BY pp.project_id
  )
  SELECT p.id, p.bride_name, p.groom_name, p.wedding_date,
         COALESCE(q.billing,0),
         COALESCE(q.billing,0) - COALESCE(q.commission_sum,0),
         COALESCE(q.commission_sum,0),
         COALESCE(pay.received_sum,0),
         GREATEST(COALESCE(pay.expected_sum,0) - COALESCE(pay.received_sum,0), 0),
         COALESCE(q.vendors,0)
  FROM public.projects p
  LEFT JOIN q ON q.pid = p.id
  LEFT JOIN pay ON pay.pid = p.id
  WHERE (_from IS NULL OR p.wedding_date >= _from)
    AND (_to   IS NULL OR p.wedding_date <= _to)
  ORDER BY p.wedding_date DESC NULLS LAST;
END;$$;
