ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS projects_archived_at_idx ON public.projects (archived_at);