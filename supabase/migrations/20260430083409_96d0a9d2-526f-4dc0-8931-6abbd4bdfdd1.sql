
-- Vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  location TEXT,
  contact_number TEXT,
  email TEXT,
  instagram_handle TEXT,
  website TEXT,
  google_rating NUMERIC(2,1),
  price_range_low NUMERIC,
  price_range_high NUMERIC,
  commission_model TEXT,
  portfolio_link TEXT,
  source TEXT DEFAULT 'Manual Entry',
  remarks TEXT,
  tags TEXT[] DEFAULT '{}',
  -- Hotel-specific
  number_of_rooms INTEGER,
  distance_from_delhi TEXT,
  hotel_category TEXT,
  -- Photography RFP
  quote_breakdown TEXT,
  team_size TEXT,
  deliverables TEXT,
  date_added TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendors_category ON public.vendors(category);
CREATE INDEX idx_vendors_location ON public.vendors(location);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open read vendors" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Open insert vendors" ON public.vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update vendors" ON public.vendors FOR UPDATE USING (true);
CREATE POLICY "Open delete vendors" ON public.vendors FOR DELETE USING (true);

-- Inbound leads table
CREATE TABLE public.inbound_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  services TEXT,
  location TEXT,
  contact TEXT,
  instagram TEXT,
  email TEXT,
  portfolio TEXT,
  status TEXT NOT NULL DEFAULT 'new'
);

ALTER TABLE public.inbound_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open read leads" ON public.inbound_leads FOR SELECT USING (true);
CREATE POLICY "Open insert leads" ON public.inbound_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update leads" ON public.inbound_leads FOR UPDATE USING (true);
CREATE POLICY "Open delete leads" ON public.inbound_leads FOR DELETE USING (true);
