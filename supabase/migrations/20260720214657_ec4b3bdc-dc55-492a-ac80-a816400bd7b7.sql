REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.client_can_view_vendor(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.client_can_access_quote(uuid, uuid) FROM anon, PUBLIC;

-- Ensure authenticated role can still call helpers used by RLS policies
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_can_view_vendor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_can_access_quote(uuid, uuid) TO authenticated;

-- Ensure service_role retains execute on internal email queue helpers
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;