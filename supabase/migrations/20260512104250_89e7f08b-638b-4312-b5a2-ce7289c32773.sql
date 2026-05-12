CREATE TABLE public.vendor_instagram_previews (
  vendor_id UUID PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  handle TEXT,
  avatar_url TEXT,
  display_name TEXT,
  bio TEXT,
  followers_text TEXT,
  post_thumbnails TEXT[],
  profile_url TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  last_error TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_instagram_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage instagram previews"
ON public.vendor_instagram_previews
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Clients view assigned vendor instagram previews"
ON public.vendor_instagram_previews
FOR SELECT
TO authenticated
USING (client_can_view_vendor(auth.uid(), vendor_id));

CREATE TRIGGER trg_vendor_instagram_previews_updated_at
BEFORE UPDATE ON public.vendor_instagram_previews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();