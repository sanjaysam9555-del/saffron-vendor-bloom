
-- Allow clients to read deadlines for projects they're assigned to
CREATE POLICY "Clients can view their project category deadlines"
ON public.project_category_deadlines
FOR SELECT
TO authenticated
USING (public.has_project_access(auth.uid(), project_id));

-- Storage RLS for instagram-cache bucket (private). Staff full access.
CREATE POLICY "Staff can read instagram-cache objects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'instagram-cache' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'employee'::public.app_role)
  )
);

CREATE POLICY "Staff can insert instagram-cache objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'instagram-cache' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'employee'::public.app_role)
  )
);

CREATE POLICY "Staff can update instagram-cache objects"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'instagram-cache' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'employee'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'instagram-cache' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'employee'::public.app_role)
  )
);

CREATE POLICY "Staff can delete instagram-cache objects"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'instagram-cache' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'employee'::public.app_role)
  )
);
