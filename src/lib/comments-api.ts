import {
  listProjectVendorComments,
  addProjectVendorComment,
  addStaffVendorComment,
  deleteProjectVendorComment,
} from "@/lib/projects.functions";

export interface VendorComment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  author_role: "staff" | "client";
  author_name: string;
  author_email: string | null;
  is_own: boolean;
}

export async function fetchVendorComments(projectId: string, vendorId: string): Promise<VendorComment[]> {
  return (await listProjectVendorComments({ data: { project_id: projectId, vendor_id: vendorId } })) as VendorComment[];
}

export async function postClientVendorComment(vendorId: string, body: string, parentId: string | null = null) {
  return await addProjectVendorComment({ data: { vendor_id: vendorId, body, parent_id: parentId } });
}

export async function postStaffVendorComment(projectId: string, vendorId: string, body: string, parentId: string | null = null) {
  return await addStaffVendorComment({ data: { project_id: projectId, vendor_id: vendorId, body, parent_id: parentId } });
}

/** @deprecated Use postClientVendorComment instead. */
export async function postVendorComment(vendorId: string, body: string) {
  return postClientVendorComment(vendorId, body, null);
}

export async function removeVendorComment(id: string) {
  return await deleteProjectVendorComment({ data: { id } });
}
