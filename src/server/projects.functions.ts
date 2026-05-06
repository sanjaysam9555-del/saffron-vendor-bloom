import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireClientUser(): Promise<{ userId: string }> {
  const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) throw new Error("Authentication is still loading. Please try again.");
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Authentication is still loading. Please try again.");
  const userId = userData.user.id;

  const { data: roleRow, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "client")
    .maybeSingle();
  if (roleError) throw new Error(roleError.message);
  if (!roleRow) throw new Error("This account is not a client account.");
  return { userId };
}

async function assertStaff(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: staff only");
}

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

// ---------- Projects ----------

export const listProjects = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .order("wedding_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");

    // List clients with email
    const { data: links } = await supabaseAdmin
      .from("project_clients")
      .select("id, user_id, created_at")
      .eq("project_id", data.id);

    const clientIds = (links ?? []).map((l) => l.user_id);
    let clientRows: {
      id: string;
      user_id: string;
      email: string;
      display_name: string;
      created_at: string;
    }[] = [];
    if (clientIds.length > 0) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", clientIds);
      const emailMap = new Map(usersData.users.map((u) => [u.id, u.email ?? ""]));
      const nameMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
      clientRows = (links ?? []).map((l) => ({
        id: l.id,
        user_id: l.user_id,
        email: emailMap.get(l.user_id) ?? "",
        display_name: nameMap.get(l.user_id) ?? "",
        created_at: l.created_at,
      }));
    }

    // Assigned vendors (full rows for staff)
    const { data: pv } = await supabaseAdmin
      .from("project_vendors")
      .select("vendor_id")
      .eq("project_id", data.id);
    const vendorIds = (pv ?? []).map((r) => r.vendor_id);
    let vendors: any[] = [];
    let selections: Record<string, { user_id: string; display_name: string; email: string; status: string; updated_at: string }[]> = {};
    if (vendorIds.length > 0) {
      const { data: vrows } = await supabaseAdmin
        .from("vendors")
        .select("*")
        .in("id", vendorIds);
      vendors = vrows ?? [];

      if (clientIds.length > 0) {
        const { data: statusRows } = await supabaseAdmin
          .from("client_vendor_status")
          .select("vendor_id, user_id, status, updated_at")
          .in("vendor_id", vendorIds)
          .in("user_id", clientIds);
        const clientLookup = new Map(clientRows.map((c) => [c.user_id, c]));
        for (const s of statusRows ?? []) {
          const c = clientLookup.get(s.user_id);
          if (!c) continue;
          (selections[s.vendor_id] ??= []).push({
            user_id: s.user_id,
            display_name: c.display_name,
            email: c.email,
            status: s.status,
            updated_at: s.updated_at,
          });
        }
      }
    }

    // Per-vendor quote summary for this project
    const quoteSummaryByVendor = new Map<string, { count: number; latest_status: string | null; has_closed: boolean; closed_amount: number | null }>();
    if (vendorIds.length > 0) {
      const { data: qrows } = await supabaseAdmin
        .from("project_vendor_quotes")
        .select("vendor_id, status, is_final, closed_amount, created_at")
        .eq("project_id", data.id)
        .in("vendor_id", vendorIds)
        .order("created_at", { ascending: false });
      for (const q of qrows ?? []) {
        const s = quoteSummaryByVendor.get(q.vendor_id) ?? { count: 0, latest_status: null, has_closed: false, closed_amount: null };
        s.count += 1;
        if (s.latest_status === null) s.latest_status = q.status;
        if (q.is_final || q.status === "closed") {
          s.has_closed = true;
          if (s.closed_amount == null) s.closed_amount = q.closed_amount;
        }
        quoteSummaryByVendor.set(q.vendor_id, s);
      }
    }
    // Per-vendor comment counts
    const commentCountByVendor = new Map<string, number>();
    if (vendorIds.length > 0) {
      const { data: crows } = await supabaseAdmin
        .from("project_vendor_comments")
        .select("vendor_id")
        .eq("project_id", data.id)
        .in("vendor_id", vendorIds);
      for (const c of crows ?? []) {
        commentCountByVendor.set(c.vendor_id, (commentCountByVendor.get(c.vendor_id) ?? 0) + 1);
      }
    }

    const vendorsWithQuotes = vendors.map((v) => ({
      ...v,
      quote_summary: quoteSummaryByVendor.get(v.id) ?? { count: 0, latest_status: null, has_closed: false, closed_amount: null },
      comment_count: commentCountByVendor.get(v.id) ?? 0,
    }));

    return { project, clients: clientRows, vendors: vendorsWithQuotes, selections };
  });

// Returns all projects with per-status vendor counts (for the projects index page).
export const listProjectsOverview = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const { data: projects, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .order("wedding_date", { ascending: true });
    if (error) throw new Error(error.message);
    if (!projects || projects.length === 0) return [];

    const projectIds = projects.map((p) => p.id);

    // project -> vendors and clients
    const [{ data: pvAll }, { data: pcAll }] = await Promise.all([
      supabaseAdmin.from("project_vendors").select("project_id, vendor_id").in("project_id", projectIds),
      supabaseAdmin.from("project_clients").select("project_id, user_id").in("project_id", projectIds),
    ]);

    const vendorCount = new Map<string, number>();
    const projectVendorPairs: { project_id: string; vendor_id: string }[] = [];
    for (const r of pvAll ?? []) {
      vendorCount.set(r.project_id, (vendorCount.get(r.project_id) ?? 0) + 1);
      projectVendorPairs.push(r);
    }
    const clientsByProject = new Map<string, string[]>();
    const allClientIds = new Set<string>();
    for (const r of pcAll ?? []) {
      const arr = clientsByProject.get(r.project_id) ?? [];
      arr.push(r.user_id);
      clientsByProject.set(r.project_id, arr);
      allClientIds.add(r.user_id);
    }

    // Fetch all relevant statuses in one go.
    const allVendorIds = Array.from(new Set(projectVendorPairs.map((p) => p.vendor_id)));
    let statusRows: { vendor_id: string; user_id: string; status: string }[] = [];
    if (allVendorIds.length > 0 && allClientIds.size > 0) {
      const { data: srows } = await supabaseAdmin
        .from("client_vendor_status")
        .select("vendor_id, user_id, status")
        .in("vendor_id", allVendorIds)
        .in("user_id", Array.from(allClientIds));
      statusRows = (srows ?? []) as any;
    }
    // index statuses by user+vendor
    const statusKey = (u: string, v: string) => `${u}::${v}`;
    const statusMap = new Map<string, string>();
    for (const s of statusRows) statusMap.set(statusKey(s.user_id, s.vendor_id), s.status);

    // Quote aggregates per project
    const { data: qAll } = await supabaseAdmin
      .from("project_vendor_quotes")
      .select("project_id, vendor_id, status, is_final")
      .in("project_id", projectIds);
    const quotesByProject = new Map<string, { total: number; vendors: Set<string>; closed: number }>();
    for (const q of qAll ?? []) {
      const s = quotesByProject.get(q.project_id) ?? { total: 0, vendors: new Set<string>(), closed: 0 };
      s.total += 1;
      s.vendors.add(q.vendor_id);
      if (q.is_final || q.status === "closed") s.closed += 1;
      quotesByProject.set(q.project_id, s);
    }

    return projects.map((p) => {
      const counts: Record<string, number> = { like: 0, shortlisted: 0, finalised: 0, rejected: 0, thinking: 0 };
      const clientIds = clientsByProject.get(p.id) ?? [];
      const vendorIdsForProject = projectVendorPairs.filter((pv) => pv.project_id === p.id).map((pv) => pv.vendor_id);
      // Count any (most-recent-not-needed for index): if any client marked vendor with status, count once per (vendor,status,client)
      for (const vid of vendorIdsForProject) {
        for (const uid of clientIds) {
          const st = statusMap.get(statusKey(uid, vid));
          if (st && st in counts) counts[st]++;
        }
      }
      const qs = quotesByProject.get(p.id);
      return {
        ...p,
        vendor_count: vendorCount.get(p.id) ?? 0,
        client_count: clientIds.length,
        status_counts: counts,
        quotes_summary: {
          total_quotes: qs?.total ?? 0,
          vendors_with_quotes: qs?.vendors.size ?? 0,
          closed_count: qs?.closed ?? 0,
        },
      };
    });
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        bride_name: z.string().min(1).max(120),
        groom_name: z.string().min(1).max(120),
        wedding_date: z.string().min(4),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .insert({
        bride_name: data.bride_name,
        groom_name: data.groom_name,
        wedding_date: data.wedding_date,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        bride_name: z.string().min(1).max(120).optional(),
        groom_name: z.string().min(1).max(120).optional(),
        wedding_date: z.string().min(4).optional(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("projects").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    // Delete client auth users linked to this project (clean up).
    const { data: links } = await supabaseAdmin
      .from("project_clients")
      .select("user_id")
      .eq("project_id", data.id);
    for (const l of links ?? []) {
      // best-effort delete of the auth user
      await supabaseAdmin.auth.admin.deleteUser(l.user_id).catch(() => {});
    }

    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Project clients (login accounts) ----------

export const createProjectClient = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        email: z.string().email(),
        password: z.string().min(6),
        display_name: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name, role: "client" },
    });
    if (error) throw new Error(error.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("Failed to create user");

    // Make sure the role row says 'client' (the trigger handles this when role is in metadata,
    // but enforce explicitly in case the trigger defaulted).
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "client" }, { onConflict: "user_id,role" });

    const { error: linkErr } = await supabaseAdmin
      .from("project_clients")
      .insert({ project_id: data.project_id, user_id: userId });
    if (linkErr) {
      // best-effort rollback
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(linkErr.message);
    }

    return { user_id: userId };
  });

export const resetProjectClientPassword = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.auth.admin.signOut(data.user_id, "global");
    return { ok: true };
  });

export const setProjectClientEmail = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), email: z.string().email() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      email: data.email,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeProjectClient = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    await supabaseAdmin
      .from("project_clients")
      .delete()
      .eq("project_id", data.project_id)
      .eq("user_id", data.user_id);
    // Also delete the auth user since each client account is tied to one project in this design.
    await supabaseAdmin.auth.admin.deleteUser(data.user_id).catch(() => {});
    return { ok: true };
  });

// ---------- Vendor ↔ Project assignment ----------

export const assignVendorToProject = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), vendor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin
      .from("project_vendors")
      .upsert(
        { project_id: data.project_id, vendor_id: data.vendor_id },
        { onConflict: "project_id,vendor_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unassignVendorFromProject = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), vendor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin
      .from("project_vendors")
      .delete()
      .eq("project_id", data.project_id)
      .eq("vendor_id", data.vendor_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignVendorsBulk = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        vendor_ids: z.array(z.string().uuid()).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    // Replace set: delete then insert.
    await supabaseAdmin.from("project_vendors").delete().eq("project_id", data.project_id);
    if (data.vendor_ids.length > 0) {
      const rows = data.vendor_ids.map((vid) => ({
        project_id: data.project_id,
        vendor_id: vid,
      }));
      const { error } = await supabaseAdmin.from("project_vendors").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Returns { vendor_id: ProjectSummary[] } so the dashboard can show chips for every vendor.
export const listVendorProjectAssignments = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const [{ data: links, error: le }, { data: projects, error: pe }] = await Promise.all([
      supabaseAdmin.from("project_vendors").select("vendor_id, project_id"),
      supabaseAdmin.from("projects").select("id, bride_name, groom_name, wedding_date"),
    ]);
    if (le) throw new Error(le.message);
    if (pe) throw new Error(pe.message);

    const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));
    const out: Record<string, { id: string; bride_name: string; groom_name: string; wedding_date: string }[]> = {};
    for (const l of links ?? []) {
      const p = projectMap.get(l.project_id);
      if (!p) continue;
      if (!out[l.vendor_id]) out[l.vendor_id] = [];
      out[l.vendor_id].push(p as any);
    }
    return out;
  });

// ---------- Client-facing ----------

export const getMyProject = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .handler(async () => {
    const { userId } = await requireClientUser();

    const { data: link } = await supabaseAdmin
      .from("project_clients")
      .select("project_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!link) throw new Error("No project assigned to this account yet");

    const { data: project, error: pe } = await supabaseAdmin
      .from("projects")
      .select("id, bride_name, groom_name, wedding_date")
      .eq("id", link.project_id)
      .maybeSingle();
    if (pe) throw new Error(pe.message);
    if (!project) throw new Error("Project not found");

    const { data: pv } = await supabaseAdmin
      .from("project_vendors")
      .select("vendor_id")
      .eq("project_id", link.project_id);
    const vendorIds = (pv ?? []).map((r) => r.vendor_id);
    if (vendorIds.length === 0) {
      return { project, vendors: [] };
    }

    const { data: vrows, error: ve } = await supabaseAdmin
      .from("vendors")
      .select("id, category, subcategory, vendor_name, location, instagram_handle, price_text, portfolio_link, website, google_rating")
      .in("id", vendorIds);
    if (ve) throw new Error(ve.message);

    const { data: atts } = await supabaseAdmin
      .from("vendor_attachments")
      .select("id, vendor_id, file_name, file_path, mime_type, size_bytes")
      .in("vendor_id", vendorIds);

    const attMap = new Map<string, any[]>();
    for (const a of atts ?? []) {
      const list = attMap.get(a.vendor_id) ?? [];
      list.push({
        id: a.id,
        file_name: a.file_name,
        file_path: a.file_path,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
      });
      attMap.set(a.vendor_id, list);
    }

    const { data: statuses } = await supabaseAdmin
      .from("client_vendor_status")
      .select("vendor_id, status")
      .eq("user_id", userId)
      .in("vendor_id", vendorIds);
    const statusMap = new Map<string, string>(
      (statuses ?? []).map((s) => [s.vendor_id, s.status]),
    );

    const { data: qrows } = await supabaseAdmin
      .from("project_vendor_quotes")
      .select("vendor_id, status, is_final, closed_amount, created_at")
      .eq("project_id", link.project_id)
      .in("vendor_id", vendorIds)
      .order("created_at", { ascending: false });
    const quoteSummaryByVendor = new Map<string, { count: number; latest_status: string | null; has_closed: boolean; closed_amount: number | null }>();
    for (const q of qrows ?? []) {
      const s = quoteSummaryByVendor.get(q.vendor_id) ?? { count: 0, latest_status: null, has_closed: false, closed_amount: null };
      s.count += 1;
      if (s.latest_status === null) s.latest_status = q.status;
      if (q.is_final || q.status === "closed") {
        s.has_closed = true;
        if (s.closed_amount == null) s.closed_amount = q.closed_amount;
      }
      quoteSummaryByVendor.set(q.vendor_id, s);
    }

    // Per-vendor comment counts (across all clients on this project)
    const commentCountByVendor = new Map<string, number>();
    {
      const { data: crows } = await supabaseAdmin
        .from("project_vendor_comments")
        .select("vendor_id")
        .eq("project_id", link.project_id)
        .in("vendor_id", vendorIds);
      for (const c of crows ?? []) {
        commentCountByVendor.set(c.vendor_id, (commentCountByVendor.get(c.vendor_id) ?? 0) + 1);
      }
    }

    const vendors = (vrows ?? []).map((v) => ({
      id: v.id,
      category: v.category,
      subcategory: v.subcategory,
      vendor_name: v.vendor_name,
      location: v.location,
      instagram_handle: v.instagram_handle,
      price_text: v.price_text,
      portfolio_link: v.portfolio_link,
      website: v.website,
      google_rating: v.google_rating,
      client_status: statusMap.get(v.id) ?? null,
      attachments: attMap.get(v.id) ?? [],
      quote_summary: quoteSummaryByVendor.get(v.id) ?? { count: 0, latest_status: null, has_closed: false, closed_amount: null },
      comment_count: commentCountByVendor.get(v.id) ?? 0,
    }));

    return { project, vendors };
  });

export const setMyVendorStatus = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z
      .object({
        vendor_id: z.string().uuid(),
        status: z
          .enum(["like", "shortlisted", "finalised", "rejected", "thinking"])
          .nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireClientUser();

    // Confirm vendor is in one of this client's projects.
    const { data: link } = await supabaseAdmin
      .from("project_clients")
      .select("project_id")
      .eq("user_id", userId);
    const projectIds = (link ?? []).map((l) => l.project_id);
    if (projectIds.length === 0) throw new Error("No project assigned");

    const { data: pv } = await supabaseAdmin
      .from("project_vendors")
      .select("vendor_id")
      .in("project_id", projectIds)
      .eq("vendor_id", data.vendor_id)
      .maybeSingle();
    if (!pv) throw new Error("Vendor not available to this client");

    if (data.status === null) {
      const { error } = await supabaseAdmin
        .from("client_vendor_status")
        .delete()
        .eq("user_id", userId)
        .eq("vendor_id", data.vendor_id);
      if (error) throw new Error(error.message);
      return { ok: true, status: null as null };
    }

    const { error } = await supabaseAdmin
      .from("client_vendor_status")
      .upsert(
        { user_id: userId, vendor_id: data.vendor_id, status: data.status },
        { onConflict: "user_id,vendor_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, status: data.status };
  });
