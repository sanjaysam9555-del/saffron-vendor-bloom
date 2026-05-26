DROP POLICY IF EXISTS "Clients read assigned vendor files" ON storage.objects;

REVOKE EXECUTE ON FUNCTION public.client_can_access_quote(uuid, uuid) FROM PUBLIC, anon;