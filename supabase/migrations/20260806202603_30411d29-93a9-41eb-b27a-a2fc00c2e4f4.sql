-- Stage enum
DO $$ BEGIN
  CREATE TYPE public.task_stage AS ENUM ('not_picked','in_progress','pending_client','pending_vendor','pending_planner','held_up','done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New columns
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS task_category text,
  ADD COLUMN IF NOT EXISTS vendor_category text,
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid,
  ADD COLUMN IF NOT EXISTS stage public.task_stage NOT NULL DEFAULT 'not_picked',
  ADD COLUMN IF NOT EXISTS preceding_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS succeeding_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL;

-- Backfill stage from done
UPDATE public.project_tasks SET stage = 'done' WHERE done = true AND stage = 'not_picked';

-- Priority migration to P0-P3
ALTER TABLE public.project_tasks DROP CONSTRAINT IF EXISTS project_tasks_priority_check;
UPDATE public.project_tasks SET priority = CASE priority
  WHEN 'high' THEN 'P1' WHEN 'medium' THEN 'P2' WHEN 'low' THEN 'P3' ELSE priority END;
ALTER TABLE public.project_tasks ALTER COLUMN priority SET DEFAULT 'P2';
ALTER TABLE public.project_tasks ADD CONSTRAINT project_tasks_priority_check
  CHECK (priority = ANY (ARRAY['P0','P1','P2','P3']));

CREATE INDEX IF NOT EXISTS idx_project_tasks_stage ON public.project_tasks(project_id, stage);

-- Task <-> vendor links
CREATE TABLE IF NOT EXISTS public.project_task_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, vendor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_vendors TO authenticated;
GRANT ALL ON public.project_task_vendors TO service_role;

ALTER TABLE public.project_task_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage task vendors" ON public.project_task_vendors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE INDEX IF NOT EXISTS idx_project_task_vendors_task ON public.project_task_vendors(task_id);