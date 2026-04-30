export interface Project {
  id: string;
  bride_name: string;
  groom_name: string;
  wedding_date: string; // ISO date
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  bride_name: string;
  groom_name: string;
  wedding_date: string;
}

export interface ProjectClient {
  id: string;
  project_id: string;
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface ClientVendor {
  id: string;
  category: string;
  subcategory: string | null;
  vendor_name: string;
  location: string | null;
  instagram_handle: string | null;
  price_text: string | null;
  portfolio_link: string | null;
  website: string | null;
  google_rating: number | null;
  attachments: {
    id: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    size_bytes: number | null;
  }[];
}
