-- 1. Remove employee DELETE on vendor-files storage (admins only)
DROP POLICY IF EXISTS "Staff delete vendor files" ON storage.objects;

-- 2. Add INSERT policy for staff on project_vendor_comments
CREATE POLICY "Staff insert comments"
ON public.project_vendor_comments
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
);