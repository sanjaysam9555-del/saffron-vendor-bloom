
-- 1. Fix handle_new_user trigger: never trust user-supplied role
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
    -- Bootstrap: first ever user becomes admin
    assigned_role := 'admin';
  ELSE
    -- Never trust user-supplied role metadata. Always default to employee.
    -- Admin promotion must be performed by an existing admin via the user_roles table.
    assigned_role := 'employee';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$function$;

-- 2. user_roles: restrict SELECT to own rows or admins
DROP POLICY IF EXISTS "User roles viewable by authenticated" ON public.user_roles;
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 3. vendors: restrict to staff only
DROP POLICY IF EXISTS "Auth read vendors" ON public.vendors;
DROP POLICY IF EXISTS "Auth insert vendors" ON public.vendors;
DROP POLICY IF EXISTS "Auth update vendors" ON public.vendors;

CREATE POLICY "Staff read vendors"
  ON public.vendors FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Staff insert vendors"
  ON public.vendors FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Staff update vendors"
  ON public.vendors FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- 4. inbound_leads: restrict reads/updates to staff
DROP POLICY IF EXISTS "Auth read leads" ON public.inbound_leads;
DROP POLICY IF EXISTS "Auth update leads" ON public.inbound_leads;

CREATE POLICY "Staff read leads"
  ON public.inbound_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Staff update leads"
  ON public.inbound_leads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- 5. vendor_attachments: restrict reads to staff or assigned clients (already partly done)
DROP POLICY IF EXISTS "Auth read attachments" ON public.vendor_attachments;
DROP POLICY IF EXISTS "Auth insert attachments" ON public.vendor_attachments;

CREATE POLICY "Staff read attachments"
  ON public.vendor_attachments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Staff insert attachments"
  ON public.vendor_attachments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- 6. Make vendor-files bucket PRIVATE
UPDATE storage.buckets SET public = false WHERE id = 'vendor-files';

-- 7. Tighten storage policies on vendor-files
DROP POLICY IF EXISTS "Public read vendor files" ON storage.objects;
DROP POLICY IF EXISTS "Open upload vendor files" ON storage.objects;
DROP POLICY IF EXISTS "Open update vendor files" ON storage.objects;
DROP POLICY IF EXISTS "Open delete vendor files" ON storage.objects;

CREATE POLICY "Staff read vendor files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vendor-files'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  );

CREATE POLICY "Staff upload vendor files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-files'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  );

CREATE POLICY "Staff update vendor files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-files'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  );

CREATE POLICY "Staff delete vendor files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-files'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
  );

-- 8. Revoke EXECUTE on internal SECURITY DEFINER helpers from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.client_can_view_vendor(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
