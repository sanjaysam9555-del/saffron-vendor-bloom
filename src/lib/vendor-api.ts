import type { Vendor, VendorInput } from "./vendor-types";
import {
  bulkDeleteVendorsServer,
  bulkInsertVendorsServer,
  bulkUpdateVendorsServer,
  createVendorServer,
  deleteVendorServer,
  listVendorsServer,
  updateVendorServer,
} from "@/lib/vendors.functions";

export async function listVendors(): Promise<Vendor[]> {
  return (await listVendorsServer()) as Vendor[];
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  return (await createVendorServer({ data: input })) as Vendor;
}

export async function updateVendor(id: string, input: Partial<VendorInput>): Promise<Vendor> {
  return (await updateVendorServer({ data: { id, input } })) as Vendor;
}

export async function deleteVendor(id: string): Promise<void> {
  await deleteVendorServer({ data: { id } });
}

export async function bulkInsertVendors(rows: VendorInput[]): Promise<number> {
  if (!rows.length) return 0;
  return await bulkInsertVendorsServer({ data: { rows } });
}

export async function bulkUpdateVendors(
  ids: string[],
  patch: Partial<VendorInput>,
): Promise<{ updated: number }> {
  return await bulkUpdateVendorsServer({ data: { ids, patch } });
}

export async function bulkDeleteVendors(ids: string[]): Promise<{ deleted: number }> {
  return await bulkDeleteVendorsServer({ data: { ids } });
}
