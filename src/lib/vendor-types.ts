export interface Vendor {
  id: string;
  vendor_name: string;
  category: string;
  subcategory: string | null;
  location: string | null;
  contact_number: string | null;
  email: string | null;
  instagram_handle: string | null;
  website: string | null;
  google_rating: number | null;
  price_range_low: number | null;
  price_range_high: number | null;
  commission_model: string | null;
  portfolio_link: string | null;
  source: string | null;
  remarks: string | null;
  tags: string[] | null;
  number_of_rooms: number | null;
  distance_from_delhi: string | null;
  hotel_category: string | null;
  quote_breakdown: string | null;
  team_size: string | null;
  deliverables: string | null;
  date_added: string;
  updated_at: string;
}

export type VendorInput = Omit<Vendor, "id" | "date_added" | "updated_at">;

export interface InboundLead {
  id: string;
  submitted_at: string;
  name: string;
  services: string | null;
  location: string | null;
  contact: string | null;
  instagram: string | null;
  email: string | null;
  portfolio: string | null;
  status: string;
}
