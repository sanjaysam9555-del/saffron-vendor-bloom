-- Tighten function permissions (skip functions that may not exist in this env)
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, PUBLIC, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, PUBLIC, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) FROM anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.client_can_view_vendor(uuid, uuid) FROM anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.client_can_access_quote(uuid, uuid) FROM anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Ensure authenticated role can still call helpers used by RLS policies
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.client_can_view_vendor(uuid, uuid) TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.client_can_access_quote(uuid, uuid) TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Ensure service_role retains execute on internal email queue helpers
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;