import { supabase } from "@/integrations/supabase/client";
import type { Vendor, VendorInput, InboundLead } from "./vendor-types";

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

export async function deleteSampleVendors(): Promise<number> {
  const { error, count } = await supabase
    .from("vendors")
    .delete({ count: "exact" })
    .eq("source", "Sample Data");
  if (error) throw error;
  return count ?? 0;
}

// Leads
export async function listLeads(): Promise<InboundLead[]> {
  const { data, error } = await supabase
    .from("inbound_leads")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InboundLead[];
}

export async function updateLeadStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("inbound_leads").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function seedSampleLeads(): Promise<void> {
  const samples = [
    {
      name: "Aarav Photography",
      services: "Wedding Photography, Pre-wedding shoots",
      location: "Delhi",
      contact: "+91 98100 11122",
      instagram: "aaravclicks",
      email: "hello@aaravclicks.in",
      portfolio: "https://aaravclicks.in",
    },
    {
      name: "Bloom & Petal Decor",
      services: "Floral decor, Mandap design",
      location: "Gurugram",
      contact: "+91 98765 23344",
      instagram: "bloomandpetal",
      email: "studio@bloomandpetal.in",
      portfolio: "https://instagram.com/bloomandpetal",
    },
    {
      name: "Royal Mehfil Catering",
      services: "Live counters, Buffet, Awadhi cuisine",
      location: "Noida",
      contact: "+91 99100 55667",
      instagram: "royalmehfil",
      email: "events@royalmehfil.in",
      portfolio: "",
    },
  ];
  await supabase.from("inbound_leads").insert(samples);
}
