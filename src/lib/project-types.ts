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
  client_status:
    | "like"
    | "shortlisted"
    | "finalised"
    | "rejected"
    | "thinking"
    | null;
  attachments: {
    id: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    size_bytes: number | null;
  }[];
  quote_summary?: {
    count: number;
    latest_status: string | null;
    latest_amount: number | null;
    has_closed: boolean;
    closed_amount: number | null;
  };
  quotes?: {
    id: string;
    status: string;
    is_final: boolean;
    quote_amount: number | null;
    closed_amount: number | null;
    created_at: string;
  }[];
  comment_count?: number;
}
