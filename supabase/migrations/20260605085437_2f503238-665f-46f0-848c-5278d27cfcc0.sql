
-- 1. Threaded replies on existing comments
ALTER TABLE public.project_vendor_comments
  ADD COLUMN parent_id uuid REFERENCES public.project_vendor_comments(id) ON DELETE SET NULL;

CREATE INDEX idx_project_vendor_comments_parent_id
  ON public.project_vendor_comments(parent_id);

-- 2. Client-facing notifications (mirrors staff_notifications, but per-user)
CREATE TABLE public.client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  vendor_id uuid,
  actor_user_id uuid,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_notifications_user_created
  ON public.client_notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.client_notifications TO authenticated;
GRANT ALL ON public.client_notifications TO service_role;

ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own client notifications"
  ON public.client_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own client notifications"
  ON public.client_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Realtime for client notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_notifications;
