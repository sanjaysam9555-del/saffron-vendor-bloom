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
  saffron_rating: number | null;
  price_text: string | null;
  commission_model: string | null;
  portfolio_link: string | null;
  source: string | null;
  remarks: string | null;
  number_of_rooms: number | null;
  distance_from_delhi: string | null;
  hotel_category: string | null;
  quote_breakdown: string | null;
  team_size: string | null;
  deliverables: string | null;
  submitted_via_form: boolean;
  date_added: string;
  updated_at: string;
  has_assignment?: boolean;
  has_quote_history?: boolean;
  has_attachment?: boolean;
}

export type VendorInput = Omit<Vendor, "id" | "date_added" | "updated_at" | "submitted_via_form" | "has_assignment" | "has_quote_history" | "has_attachment">;
