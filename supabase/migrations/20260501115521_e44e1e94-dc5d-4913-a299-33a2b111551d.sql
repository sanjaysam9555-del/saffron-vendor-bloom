ALTER TABLE public.vendors REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors;