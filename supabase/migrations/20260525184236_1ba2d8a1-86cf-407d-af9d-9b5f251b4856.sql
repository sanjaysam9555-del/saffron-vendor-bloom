
-- Tighten client SELECT on project_vendor_comments to also require vendor visibility
DROP POLICY IF EXISTS "Clients view project comments" ON public.project_vendor_comments;
CREATE POLICY "Clients view project comments"
ON public.project_vendor_comments
FOR SELECT
TO authenticated
USING (
  public.has_project_access(auth.uid(), project_id)
  AND public.client_can_view_vendor(auth.uid(), vendor_id)
);

-- Tighten client SELECT on project_vendor_quotes similarly
DROP POLICY IF EXISTS "Clients view their project quotes" ON public.project_vendor_quotes;
CREATE POLICY "Clients view their project quotes"
ON public.project_vendor_quotes
FOR SELECT
TO authenticated
USING (
  public.has_project_access(auth.uid(), project_id)
  AND public.client_can_view_vendor(auth.uid(), vendor_id)
);

-- Tighten client SELECT on project_vendor_quote_files via the quote->vendor link
DROP POLICY IF EXISTS "Clients view their project quote files" ON public.project_vendor_quote_files;
CREATE POLICY "Clients view their project quote files"
ON public.project_vendor_quote_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_vendor_quotes q
    WHERE q.id = project_vendor_quote_files.quote_id
      AND public.has_project_access(auth.uid(), q.project_id)
      AND public.client_can_view_vendor(auth.uid(), q.vendor_id)
  )
);

-- Remove vendors from realtime publication so client subscribers never receive vendor row events
ALTER PUBLICATION supabase_realtime DROP TABLE public.vendors;
