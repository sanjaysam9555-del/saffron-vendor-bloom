GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.client_can_view_vendor(uuid, uuid) TO authenticated, anon;