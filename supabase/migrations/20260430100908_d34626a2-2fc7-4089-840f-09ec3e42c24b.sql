
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "User roles viewable by authenticated"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  IF is_first THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', '')::public.app_role,
      'employee'
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tighten existing tables
DROP POLICY IF EXISTS "Open read vendors" ON public.vendors;
DROP POLICY IF EXISTS "Open insert vendors" ON public.vendors;
DROP POLICY IF EXISTS "Open update vendors" ON public.vendors;
DROP POLICY IF EXISTS "Open delete vendors" ON public.vendors;

CREATE POLICY "Auth read vendors" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update vendors" ON public.vendors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete vendors" ON public.vendors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Open read attachments" ON public.vendor_attachments;
DROP POLICY IF EXISTS "Open insert attachments" ON public.vendor_attachments;
DROP POLICY IF EXISTS "Open delete attachments" ON public.vendor_attachments;

CREATE POLICY "Auth read attachments" ON public.vendor_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert attachments" ON public.vendor_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin delete attachments" ON public.vendor_attachments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Open read leads" ON public.inbound_leads;
DROP POLICY IF EXISTS "Open insert leads" ON public.inbound_leads;
DROP POLICY IF EXISTS "Open update leads" ON public.inbound_leads;
DROP POLICY IF EXISTS "Open delete leads" ON public.inbound_leads;

CREATE POLICY "Public insert leads" ON public.inbound_leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Auth read leads" ON public.inbound_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth update leads" ON public.inbound_leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete leads" ON public.inbound_leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage policies for vendor-files: authenticated read/write, admin delete
DROP POLICY IF EXISTS "Open read vendor-files" ON storage.objects;
DROP POLICY IF EXISTS "Open insert vendor-files" ON storage.objects;
DROP POLICY IF EXISTS "Open delete vendor-files" ON storage.objects;

CREATE POLICY "Auth read vendor-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor-files');

CREATE POLICY "Auth upload vendor-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-files');

CREATE POLICY "Admin delete vendor-files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-files' AND public.has_role(auth.uid(), 'admin'));
