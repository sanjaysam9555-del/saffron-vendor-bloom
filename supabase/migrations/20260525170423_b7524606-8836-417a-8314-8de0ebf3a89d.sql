-- Restrict realtime.messages so clients can only subscribe to channels for projects they have access to.
-- Staff (admin/employee) keep full access. This prevents clients from eavesdropping on
-- broadcast/presence traffic on staff or other-project channels.

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;

-- Staff: full access to any topic
CREATE POLICY "Staff full access realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

CREATE POLICY "Staff write realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

-- Clients: only on topics scoped to a project they have access to (pattern: client-live-<project_uuid>)
CREATE POLICY "Clients read own project realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic()) LIKE 'client-live-%'
  AND public.has_project_access(
    auth.uid(),
    NULLIF(substring((realtime.topic()) FROM 'client-live-(.*)$'), '')::uuid
  )
);

CREATE POLICY "Clients write own project realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic()) LIKE 'client-live-%'
  AND public.has_project_access(
    auth.uid(),
    NULLIF(substring((realtime.topic()) FROM 'client-live-(.*)$'), '')::uuid
  )
);