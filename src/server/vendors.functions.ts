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
  saffron_rating: z.number().nullable().optional(),
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

async function requireStaffUser(): Promise<{ userId: string; email: string }> {
  const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) throw new Error("You're not signed in. Please sign in again to continue.");

  const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) throw new Error("Your session expired. Please sign in again.");

  const userId = claims.sub;
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Forbidden: staff only");
  }

  return { userId, email };
}


export const listVendorsServer = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .handler(async () => {
    await requireStaffUser();
    const [vendorsRes, assignedRes, quotedRes, attachedRes] = await Promise.all([
      supabaseAdmin
        .from("vendors")
        .select("*")
        .order("date_added", { ascending: false })
        .limit(2000),
      supabaseAdmin.from("project_vendors").select("vendor_id").limit(10000),
      supabaseAdmin.from("project_vendor_quotes").select("vendor_id").limit(10000),
      supabaseAdmin.from("vendor_attachments").select("vendor_id").limit(10000),
    ]);
    if (vendorsRes.error) throw new Error(vendorsRes.error.message);
    const assigned = new Set((assignedRes.data ?? []).map((r: any) => r.vendor_id));
    const quoted = new Set((quotedRes.data ?? []).map((r: any) => r.vendor_id));
    const attached = new Set((attachedRes.data ?? []).map((r: any) => r.vendor_id));
    return (vendorsRes.data ?? []).map((v: any) => ({
      ...v,
      has_assignment: assigned.has(v.id),
      has_quote_history: quoted.has(v.id),
      has_attachment: attached.has(v.id),
    }));
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
    const { userId } = await requireStaffUser();
    const { data: adminRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!adminRow) throw new Error("Forbidden: admin only");
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

export const bulkUpdateVendorsServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        patch: vendorInputSchema.partial(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaffUser();
    if (Object.keys(data.patch).length === 0) {
      throw new Error("No fields to update.");
    }
    const { error, count } = await supabaseAdmin
      .from("vendors")
      .update({ ...data.patch, updated_at: new Date().toISOString() }, { count: "exact" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { updated: count ?? data.ids.length };
  });

export const bulkDeleteVendorsServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { userId } = await requireStaffUser();
    const { data: adminRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!adminRow) throw new Error("Forbidden: admin only");
    const { error, count } = await supabaseAdmin
      .from("vendors")
      .delete({ count: "exact" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { deleted: count ?? data.ids.length };
  });

