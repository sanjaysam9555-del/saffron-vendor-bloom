/**
 * Client-safe types shared by the Instagram preview server functions and the
 * React components that render them. Keeping them out of the
 * `*.functions.ts` module lets that file stay a thin server-fn wrapper.
 */
export interface VendorInstagramPreview {
  vendor_id: string;
  handle: string | null;
  avatar_url: string | null;
  display_name: string | null;
  bio: string | null;
  followers_text: string | null;
  post_thumbnails: string[] | null;
  profile_url: string | null;
  status: "ok" | "not_found" | "error";
  last_error: string | null;
  fetched_at: string;
  updated_at: string;
}

export interface InstagramBackfillJob {
  id: string;
  status: "running" | "done" | "error";
  total: number;
  processed: number;
  ok: number;
  errors: number;
  pending_count: number;
  last_error: string | null;
  started_at: string;
  updated_at: string;
}

export type InstagramBackfillJobRow = {
  id: string;
  status: string;
  total: number;
  processed: number;
  ok: number;
  errors: number;
  pending_vendor_ids: string[];
  last_error: string | null;
  started_at: string;
  updated_at: string;
};
