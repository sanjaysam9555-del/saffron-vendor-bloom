
CREATE POLICY "Clients view their assigned projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), id));

CREATE POLICY "Clients view their project vendor quotes"
  ON public.project_vendor_quotes FOR SELECT
  TO authenticated
  USING (
    public.has_project_access(auth.uid(), project_id)
    AND public.client_can_view_vendor(auth.uid(), vendor_id)
  );
