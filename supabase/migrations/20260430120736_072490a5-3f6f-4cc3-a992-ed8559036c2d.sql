CREATE TYPE public.client_vendor_status_enum AS ENUM ('like', 'shortlisted', 'finalised', 'rejected', 'thinking');

CREATE TABLE public.client_vendor_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  status public.client_vendor_status_enum NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, vendor_id)
);

CREATE INDEX idx_cvs_user ON public.client_vendor_status(user_id);
CREATE INDEX idx_cvs_vendor ON public.client_vendor_status(vendor_id);

ALTER TABLE public.client_vendor_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own vendor status"
ON public.client_vendor_status
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff view all client vendor status"
ON public.client_vendor_status
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role));

CREATE TRIGGER cvs_touch_updated_at
BEFORE UPDATE ON public.client_vendor_status
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();