import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

async function assertStaff(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: staff only");
}

export const listVendorsServer = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .select("*")
      .order("date_added", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createVendorServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => vendorInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { data: row, error } = await supabaseAdmin.from("vendors").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateVendorServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), input: vendorInputSchema.partial() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
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
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin.from("vendors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkInsertVendorsServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ rows: z.array(vendorInputSchema) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    if (!data.rows.length) return 0;
    const { error, count } = await supabaseAdmin.from("vendors").insert(data.rows, { count: "exact" });
    if (error) throw new Error(error.message);
    return count ?? data.rows.length;
  });