-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-files', 'vendor-files', true)
ON CONFLICT (id) DO NOTHING;

-- Attachments table
CREATE TABLE IF NOT EXISTS public.vendor_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_attachments_vendor_id ON public.vendor_attachments(vendor_id);

ALTER TABLE public.vendor_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open read attachments" ON public.vendor_attachments FOR SELECT USING (true);
CREATE POLICY "Open insert attachments" ON public.vendor_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Open delete attachments" ON public.vendor_attachments FOR DELETE USING (true);

-- Storage policies for vendor-files bucket
CREATE POLICY "Public read vendor files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-files');

CREATE POLICY "Open upload vendor files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vendor-files');

CREATE POLICY "Open update vendor files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'vendor-files');

CREATE POLICY "Open delete vendor files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'vendor-files');