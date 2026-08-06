-- 1. New table: vendor_payment_installments
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
  due_date date,
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

-- 2. Extend project_vendor_quotes
ALTER TABLE public.project_vendor_quotes
  ADD COLUMN IF NOT EXISTS total_vendor_payment_installments smallint NOT NULL DEFAULT 1 CHECK (total_vendor_payment_installments BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS vendor_payment_remarks text;

-- 3. RPC: per-project vendor payment matrix
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

-- 4. RPC: upcoming receivables (next pending installment per project)
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
  SELECT DISTINCT ON (p.id)
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
  ORDER BY p.id, pp.installment_no ASC NULLS LAST, pp.due_date ASC NULLS LAST;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_upcoming_receivables() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upcoming_receivables() TO authenticated;

-- 5. RPC: upcoming vendor payments (next pending installment per project+vendor)
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
  SELECT DISTINCT ON (vpi.project_id, vpi.vendor_id)
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
  ORDER BY vpi.project_id, vpi.vendor_id, vpi.installment_no ASC NULLS LAST, vpi.due_date ASC NULLS LAST;
END;$$;

REVOKE EXECUTE ON FUNCTION public.admin_upcoming_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upcoming_payments() TO authenticated;

-- 6. Studio settings (singleton)
CREATE TABLE IF NOT EXISTS public.studio_settings (
  id            boolean primary key default true constraint studio_settings_singleton check (id),
  brand_name    text        not null default 'Saffron Planning Studio',
  primary_color text        not null default 'terracotta',
  display_font  text        not null default 'cormorant',
  updated_at    timestamptz not null default now(),
  updated_by    uuid        references auth.users (id) on delete set null
);

INSERT INTO public.studio_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, UPDATE ON public.studio_settings TO authenticated;
GRANT ALL ON public.studio_settings TO service_role;

ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS studio_settings_read ON public.studio_settings;
CREATE POLICY studio_settings_read
  ON public.studio_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS studio_settings_write ON public.studio_settings;
CREATE POLICY studio_settings_write
  ON public.studio_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. project_tasks
CREATE TABLE public.project_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  owner_name  text,
  due_date    date,
  priority    text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  done        boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_tasks_project ON public.project_tasks(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT ALL ON public.project_tasks TO service_role;

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage project tasks"
  ON public.project_tasks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Clients read their project tasks"
  ON public.project_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_clients pc
      WHERE pc.project_id = project_tasks.project_id
        AND pc.user_id = auth.uid()
    )
  );

CREATE TRIGGER touch_project_tasks
BEFORE UPDATE ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. project_guests
CREATE TABLE public.project_guests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name         text NOT NULL,
  phone        text,
  side         text CHECK (side IN ('bride', 'groom')),
  category     text,
  plus_one     integer NOT NULL DEFAULT 0,
  meal         text,
  rsvp_status  text NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('yes', 'no', 'maybe', 'pending')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_guests_project ON public.project_guests(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_guests TO authenticated;
GRANT ALL ON public.project_guests TO service_role;

ALTER TABLE public.project_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage project guests"
  ON public.project_guests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Clients read their project guests"
  ON public.project_guests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_clients pc
      WHERE pc.project_id = project_guests.project_id
        AND pc.user_id = auth.uid()
    )
  );

CREATE TRIGGER touch_project_guests
BEFORE UPDATE ON public.project_guests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();