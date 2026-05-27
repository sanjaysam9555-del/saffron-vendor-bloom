
-- Restrict delete to admin only for tables with "Staff manage X" ALL policies

-- projects
DROP POLICY IF EXISTS "Staff manage projects" ON public.projects;
CREATE POLICY "Staff select projects" ON public.projects FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff insert projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff update projects" ON public.projects FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admin delete projects" ON public.projects FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- project_clients
DROP POLICY IF EXISTS "Staff manage project_clients" ON public.project_clients;
CREATE POLICY "Staff select project_clients" ON public.project_clients FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff insert project_clients" ON public.project_clients FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff update project_clients" ON public.project_clients FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admin delete project_clients" ON public.project_clients FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- project_vendors
DROP POLICY IF EXISTS "Staff manage project_vendors" ON public.project_vendors;
CREATE POLICY "Staff select project_vendors" ON public.project_vendors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff insert project_vendors" ON public.project_vendors FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff update project_vendors" ON public.project_vendors FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admin delete project_vendors" ON public.project_vendors FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- project_vendor_quotes
DROP POLICY IF EXISTS "Staff manage project vendor quotes" ON public.project_vendor_quotes;
CREATE POLICY "Staff select project vendor quotes" ON public.project_vendor_quotes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff insert project vendor quotes" ON public.project_vendor_quotes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff update project vendor quotes" ON public.project_vendor_quotes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admin delete project vendor quotes" ON public.project_vendor_quotes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- project_vendor_quote_files
DROP POLICY IF EXISTS "Staff manage quote files" ON public.project_vendor_quote_files;
CREATE POLICY "Staff select quote files" ON public.project_vendor_quote_files FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff insert quote files" ON public.project_vendor_quote_files FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff update quote files" ON public.project_vendor_quote_files FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admin delete quote files" ON public.project_vendor_quote_files FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- project_category_deadlines
DROP POLICY IF EXISTS "Staff manage category deadlines" ON public.project_category_deadlines;
CREATE POLICY "Staff select category deadlines" ON public.project_category_deadlines FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff insert category deadlines" ON public.project_category_deadlines FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff update category deadlines" ON public.project_category_deadlines FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admin delete category deadlines" ON public.project_category_deadlines FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- vendor_instagram_previews
DROP POLICY IF EXISTS "Staff manage instagram previews" ON public.vendor_instagram_previews;
CREATE POLICY "Staff select instagram previews" ON public.vendor_instagram_previews FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff insert instagram previews" ON public.vendor_instagram_previews FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff update instagram previews" ON public.vendor_instagram_previews FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admin delete instagram previews" ON public.vendor_instagram_previews FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- instagram_backfill_jobs
DROP POLICY IF EXISTS "Staff manage instagram backfill jobs" ON public.instagram_backfill_jobs;
CREATE POLICY "Staff select instagram backfill jobs" ON public.instagram_backfill_jobs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff insert instagram backfill jobs" ON public.instagram_backfill_jobs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Staff update instagram backfill jobs" ON public.instagram_backfill_jobs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "Admin delete instagram backfill jobs" ON public.instagram_backfill_jobs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- project_vendor_comments: restrict staff "delete any" to admin only
DROP POLICY IF EXISTS "Staff delete any comment" ON public.project_vendor_comments;
CREATE POLICY "Admin delete any comment" ON public.project_vendor_comments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
