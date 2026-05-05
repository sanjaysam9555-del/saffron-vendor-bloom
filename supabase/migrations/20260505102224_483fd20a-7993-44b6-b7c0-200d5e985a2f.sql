REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_can_view_vendor(uuid, uuid) FROM anon;