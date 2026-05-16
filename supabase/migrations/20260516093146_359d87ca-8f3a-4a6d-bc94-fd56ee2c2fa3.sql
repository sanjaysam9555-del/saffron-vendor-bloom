
CREATE TABLE public.project_category_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  category text NOT NULL,
  due_date date,
  criticality text NOT NULL DEFAULT 'medium' CHECK (criticality IN ('low','medium','high')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, category)
);

CREATE INDEX idx_pcd_project ON public.project_category_deadlines(project_id);

ALTER TABLE public.project_category_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage category deadlines"
ON public.project_category_deadlines
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Clients view their project deadlines"
ON public.project_category_deadlines
FOR SELECT TO authenticated
USING (public.has_project_access(auth.uid(), project_id));

CREATE TRIGGER touch_pcd_updated_at
BEFORE UPDATE ON public.project_category_deadlines
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_category_deadlines;
