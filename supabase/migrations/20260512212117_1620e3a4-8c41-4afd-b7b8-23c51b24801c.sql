
CREATE TABLE public.staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('comment','status_change')),
  project_id uuid,
  vendor_id uuid,
  actor_user_id uuid,
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_by jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX staff_notifications_created_at_idx
  ON public.staff_notifications (created_at DESC);

ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view notifications"
  ON public.staff_notifications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Staff update notifications"
  ON public.staff_notifications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_notifications;
ALTER TABLE public.staff_notifications REPLICA IDENTITY FULL;
