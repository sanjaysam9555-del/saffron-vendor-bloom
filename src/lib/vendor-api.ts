import { supabase } from "@/integrations/supabase/client";
import type { Vendor, VendorInput } from "./vendor-types";

export async function listVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("date_added", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as Vendor[];
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  const { data, error } = await supabase.from("vendors").insert(input).select().single();
  if (error) throw error;
  return data as Vendor;
}

export async function updateVendor(id: string, input: Partial<VendorInput>): Promise<Vendor> {
  const { data, error } = await supabase
    .from("vendors")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Vendor;
}

export async function deleteVendor(id: string): Promise<void> {
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkInsertVendors(rows: VendorInput[]): Promise<number> {
  if (!rows.length) return 0;
  const { error, count } = await supabase.from("vendors").insert(rows, { count: "exact" });
  if (error) throw error;
  return count ?? rows.length;
}
