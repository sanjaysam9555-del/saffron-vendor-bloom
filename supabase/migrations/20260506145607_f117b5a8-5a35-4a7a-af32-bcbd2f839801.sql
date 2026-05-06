-- Comments table for clients to comment on assigned vendors within a project.
CREATE TABLE public.project_vendor_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pvc_project_vendor_created
  ON public.project_vendor_comments (project_id, vendor_id, created_at);

CREATE INDEX idx_pvc_user
  ON public.project_vendor_comments (user_id);

ALTER TABLE public.project_vendor_comments ENABLE ROW LEVEL SECURITY;

-- Clients can read comments for projects they have access to.
CREATE POLICY "Clients view project comments"
ON public.project_vendor_comments
FOR SELECT
TO authenticated
USING (public.has_project_access(auth.uid(), project_id));

-- Clients insert comments only as themselves and only on vendors in their project.
CREATE POLICY "Clients insert own comments"
ON public.project_vendor_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.has_project_access(auth.uid(), project_id)
  AND EXISTS (
    SELECT 1 FROM public.project_vendors pv
    WHERE pv.project_id = project_vendor_comments.project_id
      AND pv.vendor_id = project_vendor_comments.vendor_id
  )
);

-- Clients can delete their own comments.
CREATE POLICY "Clients delete own comments"
ON public.project_vendor_comments
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Staff can read all comments.
CREATE POLICY "Staff view all comments"
ON public.project_vendor_comments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role));

-- Staff can delete any comment.
CREATE POLICY "Staff delete any comment"
ON public.project_vendor_comments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_vendor_comments;
