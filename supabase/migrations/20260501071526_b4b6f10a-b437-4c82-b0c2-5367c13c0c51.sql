DROP POLICY IF EXISTS "Auth read vendor-files" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload vendor-files" ON storage.objects;

CREATE POLICY "Clients read assigned vendor files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vendor-files'
  AND EXISTS (
    SELECT 1
    FROM public.vendor_attachments va
    WHERE va.file_path = storage.objects.name
      AND public.client_can_view_vendor(auth.uid(), va.vendor_id)
  )
);

DROP POLICY IF EXISTS "Clients manage own vendor status" ON public.client_vendor_status;

CREATE POLICY "Clients select own vendor status"
ON public.client_vendor_status
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Clients insert own vendor status"
ON public.client_vendor_status
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.client_can_view_vendor(auth.uid(), vendor_id)
);

CREATE POLICY "Clients update own vendor status"
ON public.client_vendor_status
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND public.client_can_view_vendor(auth.uid(), vendor_id)
);

CREATE POLICY "Clients delete own vendor status"
ON public.client_vendor_status
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
