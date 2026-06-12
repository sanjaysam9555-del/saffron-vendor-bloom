CREATE TABLE public.project_other_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  planned_amount numeric NULL,
  actual_amount numeric NULL,
  notes text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_other_expenses_project_idx ON public.project_other_expenses(project_id);
CREATE UNIQUE INDEX project_other_expenses_project_label_uniq ON public.project_other_expenses(project_id, lower(label));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_other_expenses TO authenticated;
GRANT ALL ON public.project_other_expenses TO service_role;

ALTER TABLE public.project_other_expenses ENABLE ROW LEVEL SECURITY;

-- Staff (admin/employee) full access
CREATE POLICY "Staff can read other expenses"
  ON public.project_other_expenses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Staff can insert other expenses"
  ON public.project_other_expenses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Staff can update other expenses"
  ON public.project_other_expenses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Admins can delete other expenses"
  ON public.project_other_expenses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Clients of the project can read
CREATE POLICY "Project clients can read other expenses"
  ON public.project_other_expenses FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

CREATE TRIGGER project_other_expenses_touch_updated_at
  BEFORE UPDATE ON public.project_other_expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();