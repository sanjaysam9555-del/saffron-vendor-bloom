-- Fix CLIENT_SIDE_AUTH: self-registration should not grant employee/staff access.
-- Default new users to the 'client' role. Staff promotion must be performed
-- by an existing admin via the user_roles table. The very first ever user
-- still bootstraps as admin (initial install).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_first BOOLEAN;
  assigned_role public.app_role;
  user_email TEXT;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  user_email := lower(COALESCE(NEW.email, ''));

  IF is_first AND user_email LIKE '%@saffronevents.in' THEN
    -- Bootstrap: first ever user (staff email) becomes admin.
    assigned_role := 'admin';
  ELSE
    -- Default everyone else to 'client'. Admins promote staff manually.
    assigned_role := 'client';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$function$;

-- Defense-in-depth: prevent any non-saffronevents.in email from ever holding
-- admin/employee role, even if mis-inserted.
CREATE OR REPLACE FUNCTION public.enforce_staff_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email TEXT;
BEGIN
  IF NEW.role IN ('admin','employee') THEN
    SELECT lower(email) INTO user_email FROM auth.users WHERE id = NEW.user_id;
    IF user_email IS NULL OR user_email NOT LIKE '%@saffronevents.in' THEN
      RAISE EXCEPTION 'Only @saffronevents.in accounts may hold staff roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_staff_email_domain_trg ON public.user_roles;
CREATE TRIGGER enforce_staff_email_domain_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_email_domain();

-- Fix MISSING_RLS_PROTECTION on quote files realtime exposure:
-- Quote-file metadata does not need realtime; admin UI refetches on demand.
ALTER PUBLICATION supabase_realtime DROP TABLE public.project_vendor_quote_files;

-- Fix REALTIME_UNRESTRICTED_CHANNEL_ACCESS:
-- Lock down Broadcast and Presence channels to authenticated users only.
-- (postgres_changes is already filtered by table RLS by Supabase Realtime.)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can write realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);
