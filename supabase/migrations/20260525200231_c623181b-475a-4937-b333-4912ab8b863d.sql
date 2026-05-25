-- 1. Tighten "Clients insert own comments" — require client_can_view_vendor
DROP POLICY IF EXISTS "Clients insert own comments" ON public.project_vendor_comments;
CREATE POLICY "Clients insert own comments"
ON public.project_vendor_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.has_project_access(auth.uid(), project_id)
  AND public.client_can_view_vendor(auth.uid(), vendor_id)
  AND EXISTS (
    SELECT 1 FROM public.project_vendors pv
    WHERE pv.project_id = project_vendor_comments.project_id
      AND pv.vendor_id = project_vendor_comments.vendor_id
  )
);

-- 2. Security-definer helper so the quote-files policy doesn't need the
--    "Clients view their project quotes" policy to remain in place.
CREATE OR REPLACE FUNCTION public.client_can_access_quote(_user_id uuid, _quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_vendor_quotes q
    WHERE q.id = _quote_id
      AND public.has_project_access(_user_id, q.project_id)
      AND public.client_can_view_vendor(_user_id, q.vendor_id)
  );
$$;

-- 3. Drop client direct-read on project_vendor_quotes; clients will now read
--    sanitized rows through a server function.
DROP POLICY IF EXISTS "Clients view their project quotes" ON public.project_vendor_quotes;

-- 4. Rewrite quote-files client SELECT to use the security-definer helper.
DROP POLICY IF EXISTS "Clients view their project quote files" ON public.project_vendor_quote_files;
CREATE POLICY "Clients view their project quote files"
ON public.project_vendor_quote_files
FOR SELECT
TO authenticated
USING (public.client_can_access_quote(auth.uid(), quote_id));
