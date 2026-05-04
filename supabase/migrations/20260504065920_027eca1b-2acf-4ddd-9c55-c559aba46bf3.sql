CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_base boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Staff update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Admin delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER categories_touch_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.categories (name, is_base) VALUES
  ('Photography & Videography', true),
  ('Decor', true),
  ('Catering', true),
  ('Sound & Lighting', true),
  ('Production & Event Management', true),
  ('Special Effects (SFX)', true),
  ('Makeup Artists', true),
  ('Mehendi Artists', true),
  ('Hospitality & Manpower', true),
  ('Anchors & Emcees', true),
  ('Car Rental & Transport', true),
  ('Hotels & Venues', true),
  ('DJs & Live Music', true),
  ('Miscellaneous', true)
ON CONFLICT (name) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER TABLE public.categories REPLICA IDENTITY FULL;