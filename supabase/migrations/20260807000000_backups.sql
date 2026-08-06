-- Backup & Restore infrastructure: a private storage bucket for backup
-- files, and a metadata table so the admin UI can list/label backups
-- without listing raw storage objects.

INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin read backups"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin upload backups"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete backups"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('automatic', 'manual')),
  size_bytes bigint,
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backups_created_at ON public.backups (created_at DESC);

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage backups"
  ON public.backups
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT ALL ON public.backups TO service_role;
GRANT SELECT, INSERT, DELETE ON public.backups TO authenticated;
