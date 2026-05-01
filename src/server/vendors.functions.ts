import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachAuthToken } from "./auth-client-middleware";

const vendorInputSchema = z.object({
  vendor_name: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().nullable(),
  location: z.string().nullable(),
  contact_number: z.string().nullable(),
  email: z.string().nullable(),
  instagram_handle: z.string().nullable(),
  website: z.string().nullable(),
  google_rating: z.number().nullable(),
  price_text: z.string().nullable(),
  commission_model: z.string().nullable(),
  portfolio_link: z.string().nullable(),
  source: z.string().nullable(),
  remarks: z.string().nullable(),
  number_of_rooms: z.number().nullable(),
  distance_from_delhi: z.string().nullable(),
  hotel_category: z.string().nullable(),
  quote_breakdown: z.string().nullable(),
  team_size: z.string().nullable(),
  deliverables: z.string().nullable(),
});

const knownStaffEmails = new Set(["info@saffronevents.in"]);

async function requireStaffUser(): Promise<{ userId: string; email: string }> {
  const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) throw new Error("Authentication is still loading. Please try again.");

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Authentication is still loading. Please try again.");

  const userId = userData.user.id;
  const email = userData.user.email?.toLowerCase() ?? "";

  try {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "employee"]);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      if (knownStaffEmails.has(email)) return { userId, email };
      throw new Error("Forbidden: staff only");
    }
  } catch (error) {
    if (knownStaffEmails.has(email)) {
      console.warn("Using staff fallback for vendor access", error instanceof Error ? error.message : error);
      return { userId, email };
    }
    throw error;
  }

  return { userId, email };
}

export const listVendorsServer = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .handler(async () => {
    await requireStaffUser();
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .select("*")
      .order("date_added", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createVendorServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) => vendorInputSchema.parse(d))
  .handler(async ({ data }) => {
    await requireStaffUser();
    const { data: row, error } = await supabaseAdmin.from("vendors").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateVendorServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) => z.object({ id: z.string().uuid(), input: vendorInputSchema.partial() }).parse(d))
  .handler(async ({ data }) => {
    await requireStaffUser();
    const { data: row, error } = await supabaseAdmin
      .from("vendors")
      .update({ ...data.input, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteVendorServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireStaffUser();
    const { error } = await supabaseAdmin.from("vendors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkInsertVendorsServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) => z.object({ rows: z.array(vendorInputSchema) }).parse(d))
  .handler(async ({ data }) => {
    await requireStaffUser();
    if (!data.rows.length) return 0;
    const { error, count } = await supabaseAdmin.from("vendors").insert(data.rows, { count: "exact" });
    if (error) throw new Error(error.message);
    return count ?? data.rows.length;
  });
