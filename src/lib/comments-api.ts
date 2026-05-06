import {
  listProjectVendorComments,
  addProjectVendorComment,
  deleteProjectVendorComment,
} from "@/server/projects.functions";

export interface VendorComment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  author_name: string;
  author_email: string | null;
  is_own: boolean;
}

export async function fetchVendorComments(projectId: string, vendorId: string): Promise<VendorComment[]> {
  return (await listProjectVendorComments({ data: { project_id: projectId, vendor_id: vendorId } })) as VendorComment[];
}

export async function postVendorComment(vendorId: string, body: string) {
  return await addProjectVendorComment({ data: { vendor_id: vendorId, body } });
}

export async function removeVendorComment(id: string) {
  return await deleteProjectVendorComment({ data: { id } });
}
