-- Two new project-scoped tables backing the Tasks and Guests tabs on the
-- project detail page. NOT YET APPLIED — review and run against the dev
-- project (pbxiuwthwmncdeidsesb) when ready. Never run against live.

-- ─────────────────────────────────────────────────────────────────────────
-- project_tasks
-- ─────────────────────────────────────────────────────────────────────────
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

-- Staff manage tasks. Server functions use the service role and enforce
-- staff/client checks themselves (same pattern as project_category_deadlines
-- and project_other_expenses) — this policy is defense-in-depth for any
-- direct client access.
CREATE POLICY "Staff manage project tasks"
  ON public.project_tasks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- Clients on the project can read (not write) its task list.
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

-- ─────────────────────────────────────────────────────────────────────────
-- project_guests
-- ─────────────────────────────────────────────────────────────────────────
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
