-- 1. Extend app_role enum with 'client'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- 2. projects table
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bride_name text NOT NULL,
  groom_name text NOT NULL,
  wedding_date date NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3. project_clients table
CREATE TABLE public.project_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX idx_project_clients_user ON public.project_clients(user_id);
CREATE INDEX idx_project_clients_project ON public.project_clients(project_id);

ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;

-- 4. project_vendors table
CREATE TABLE public.project_vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (project_id, vendor_id)
);
CREATE INDEX idx_project_vendors_project ON public.project_vendors(project_id);
CREATE INDEX idx_project_vendors_vendor ON public.project_vendors(vendor_id);

ALTER TABLE public.project_vendors ENABLE ROW LEVEL SECURITY;

-- 5. Helper: has_project_access (security definer) for clients
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_clients
    WHERE user_id = _user_id AND project_id = _project_id
  );
$$;

-- 6. Helper: client_can_view_vendor (security definer)
CREATE OR REPLACE FUNCTION public.client_can_view_vendor(_user_id uuid, _vendor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_vendors pv
    JOIN public.project_clients pc ON pc.project_id = pv.project_id
    WHERE pc.user_id = _user_id AND pv.vendor_id = _vendor_id
  );
$$;

-- 7. updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_touch_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. RLS policies for projects
CREATE POLICY "Staff manage projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Clients view their project"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), id));

-- 9. RLS policies for project_clients
CREATE POLICY "Staff manage project_clients"
  ON public.project_clients FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Clients view own link"
  ON public.project_clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 10. RLS policies for project_vendors
CREATE POLICY "Staff manage project_vendors"
  ON public.project_vendors FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Clients view their project vendors"
  ON public.project_vendors FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

-- 11. Extra read policy for vendor_attachments so clients can see attachments
--     only for vendors assigned to their project.
CREATE POLICY "Clients view assigned vendor attachments"
  ON public.vendor_attachments FOR SELECT
  TO authenticated
  USING (public.client_can_view_vendor(auth.uid(), vendor_id));

-- 12. Update handle_new_user to acknowledge 'client' role from metadata.
--     The existing function already reads NEW.raw_user_meta_data->>'role',
--     so 'client' will just work after the enum was extended. We re-create
--     it idempotently to make sure it's current.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;