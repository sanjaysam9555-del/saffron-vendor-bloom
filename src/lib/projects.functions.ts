import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireClientUser(): Promise<{ userId: string }> {
  const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) {
    // Transient: client middleware hadn't attached the bearer yet. Surface
    // a retry-friendly message so the caller can show a toast and let the
    // user retry, instead of being interpreted as "session expired".
    throw new Error("Please try that again in a moment.");
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error("Please try that again in a moment.");
  }
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
      .select("vendor_id, is_saffron_pick")
      .eq("project_id", data.id);
    const vendorIds = (pv ?? []).map((r) => r.vendor_id);
    const saffronPickMap = new Map<string, boolean>(
      (pv ?? []).map((r) => [r.vendor_id, !!r.is_saffron_pick]),
    );
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
    const quoteSummaryByVendor = new Map<string, { count: number; latest_status: string | null; latest_amount: number | null; has_closed: boolean; closed_amount: number | null }>();
    if (vendorIds.length > 0) {
      const { data: qrows } = await supabaseAdmin
        .from("project_vendor_quotes")
        .select("vendor_id, status, is_final, quote_amount, closed_amount, created_at")
        .eq("project_id", data.id)
        .in("vendor_id", vendorIds)
        .order("created_at", { ascending: false });
      for (const q of qrows ?? []) {
        const s = quoteSummaryByVendor.get(q.vendor_id) ?? { count: 0, latest_status: null, latest_amount: null, has_closed: false, closed_amount: null };
        s.count += 1;
        if (s.latest_status === null) s.latest_status = q.status;
        if (s.latest_amount === null) s.latest_amount = q.quote_amount;
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
      is_saffron_pick: saffronPickMap.get(v.id) ?? false,
      quote_summary: quoteSummaryByVendor.get(v.id) ?? { count: 0, latest_status: null, latest_amount: null, has_closed: false, closed_amount: null },
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
      supabaseAdmin.from("project_vendors").select("project_id, vendor_id, is_saffron_pick").in("project_id", projectIds),
      supabaseAdmin.from("project_clients").select("project_id, user_id").in("project_id", projectIds),
    ]);

    const vendorCount = new Map<string, number>();
    const saffronPickCount = new Map<string, number>();
    const projectVendorPairs: { project_id: string; vendor_id: string }[] = [];
    for (const r of pvAll ?? []) {
      vendorCount.set(r.project_id, (vendorCount.get(r.project_id) ?? 0) + 1);
      if (r.is_saffron_pick) saffronPickCount.set(r.project_id, (saffronPickCount.get(r.project_id) ?? 0) + 1);
      projectVendorPairs.push({ project_id: r.project_id, vendor_id: r.vendor_id });
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
      .select("project_id, vendor_id, status, is_final, closed_amount, quote_amount")
      .in("project_id", projectIds);
    const quotesByProject = new Map<string, { total: number; vendors: Set<string>; closed: number; finalisedVendors: Set<string>; closedTotal: number }>();
    for (const q of qAll ?? []) {
      const s = quotesByProject.get(q.project_id) ?? { total: 0, vendors: new Set<string>(), closed: 0, finalisedVendors: new Set<string>(), closedTotal: 0 };
      s.total += 1;
      s.vendors.add(q.vendor_id);
      if (q.is_final || q.status === "closed") {
        s.closed += 1;
        s.finalisedVendors.add(q.vendor_id);
        const amt = q.closed_amount ?? q.quote_amount;
        if (amt != null) s.closedTotal += Number(amt);
      }
      quotesByProject.set(q.project_id, s);
    }

    return projects.map((p) => {
      const counts: Record<string, number> = { like: 0, shortlisted: 0, finalised: 0, rejected: 0, thinking: 0 };
      const clientIds = clientsByProject.get(p.id) ?? [];
      const vendorIdsForProject = projectVendorPairs.filter((pv) => pv.project_id === p.id).map((pv) => pv.vendor_id);
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
        saffron_pick_count: saffronPickCount.get(p.id) ?? 0,
        status_counts: counts,
        quotes_summary: {
          total_quotes: qs?.total ?? 0,
          vendors_with_quotes: qs?.vendors.size ?? 0,
          closed_count: qs?.closed ?? 0,
          finalised_vendors: qs?.finalisedVendors.size ?? 0,
          closed_total_amount: qs?.closedTotal ?? 0,
        },
      };
    });
  });

// Toggle project archived state. Staff only.
export const setProjectArchived = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin
      .from("projects")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Staff-only: returns the same shape as getMyProject but for a chosen client on a project.
// Used by the admin "View as client" preview. Does NOT write any rows as the client.
export const getProjectAsClientView = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), client_user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);

    // Confirm the chosen client is actually linked to this project.
    const { data: link } = await supabaseAdmin
      .from("project_clients")
      .select("project_id")
      .eq("user_id", data.client_user_id)
      .eq("project_id", data.project_id)
      .maybeSingle();
    if (!link) throw new Error("That client is not linked to this project");

    const projectId = data.project_id;
    const userId = data.client_user_id;

    const [projectRes, pvRes] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id, bride_name, groom_name, wedding_date")
        .eq("id", projectId)
        .maybeSingle(),
      supabaseAdmin
        .from("project_vendors")
        .select("vendor_id, is_saffron_pick, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);
    if (projectRes.error) throw new Error(projectRes.error.message);
    const project = projectRes.data;
    if (!project) throw new Error("Project not found");

    const pv = pvRes.data;
    const vendorIds = (pv ?? []).map((r) => r.vendor_id);
    const saffronPickMap = new Map<string, boolean>(
      (pv ?? []).map((r) => [r.vendor_id, !!r.is_saffron_pick]),
    );
    if (vendorIds.length === 0) return { project, vendors: [] };

    const [vendorsRes, attsRes, statusesRes, quotesRes, commentsRes] = await Promise.all([
      supabaseAdmin
        .from("vendors")
        .select("id, category, subcategory, vendor_name, location, instagram_handle, price_text, portfolio_link, website, google_rating")
        .in("id", vendorIds),
      supabaseAdmin
        .from("vendor_attachments")
        .select("id, vendor_id, file_name, file_path, mime_type, size_bytes")
        .in("vendor_id", vendorIds),
      supabaseAdmin
        .from("client_vendor_status")
        .select("vendor_id, status")
        .eq("user_id", userId)
        .in("vendor_id", vendorIds),
      supabaseAdmin
        .from("project_vendor_quotes")
        .select("id, vendor_id, status, is_final, quote_amount, closed_amount, created_at")
        .eq("project_id", projectId)
        .in("vendor_id", vendorIds)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("project_vendor_comments")
        .select("vendor_id")
        .eq("project_id", projectId)
        .in("vendor_id", vendorIds),
    ]);

    const attMap = new Map<string, any[]>();
    for (const a of attsRes.data ?? []) {
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
    const statusMap = new Map<string, string>(
      (statusesRes.data ?? []).map((s) => [s.vendor_id, s.status]),
    );

    const quoteSummaryByVendor = new Map<string, any>();
    const quotesByVendor = new Map<string, any[]>();
    for (const q of quotesRes.data ?? []) {
      const s = quoteSummaryByVendor.get(q.vendor_id) ?? { count: 0, latest_status: null, latest_amount: null, has_closed: false, closed_amount: null };
      s.count += 1;
      if (s.latest_status === null) s.latest_status = q.status;
      if (s.latest_amount === null) s.latest_amount = q.quote_amount;
      if (q.is_final || q.status === "closed") {
        s.has_closed = true;
        if (s.closed_amount == null) s.closed_amount = q.closed_amount;
      }
      quoteSummaryByVendor.set(q.vendor_id, s);
      const list = quotesByVendor.get(q.vendor_id) ?? [];
      list.push({
        id: q.id,
        status: q.status,
        is_final: q.is_final,
        quote_amount: q.quote_amount,
        closed_amount: q.closed_amount,
        created_at: q.created_at,
      });
      quotesByVendor.set(q.vendor_id, list);
    }
    const commentCountByVendor = new Map<string, number>();
    for (const c of commentsRes.data ?? []) {
      commentCountByVendor.set(c.vendor_id, (commentCountByVendor.get(c.vendor_id) ?? 0) + 1);
    }

    const vendorById = new Map((vendorsRes.data ?? []).map((v) => [v.id, v]));
    const vendors = vendorIds
      .map((id) => vendorById.get(id))
      .filter((v): v is NonNullable<typeof v> => !!v)
      .map((v) => ({
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
        quote_summary: quoteSummaryByVendor.get(v.id) ?? { count: 0, latest_status: null, latest_amount: null, has_closed: false, closed_amount: null },
        quotes: quotesByVendor.get(v.id) ?? [],
        comment_count: commentCountByVendor.get(v.id) ?? 0,
        is_saffron_pick: saffronPickMap.get(v.id) ?? false,
      }));

    return { project, vendors };
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
        total_installments: z.number().int().min(1).max(4),
        planning_fee: z.number().nonnegative(),
        target_income: z.number().nonnegative().optional(),
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
        total_installments: data.total_installments,
        planning_fee: data.planning_fee,
        target_income: data.target_income ?? 0,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (row?.id) {
      const seedRows = Array.from({ length: data.total_installments }, (_, i) => ({
        project_id: row.id as string,
        installment_no: i + 1,
        label: `Installment ${i + 1}`,
        expected_amount: 0,
        received_amount: 0,
        status: "pending" as const,
        created_by: context.userId,
      }));
      await supabaseAdmin.from("project_payments").insert(seedRows);
    }

    return row;
  });

const projectInputSchema = z.object({
  bride_name: z.string().min(1).max(120),
  groom_name: z.string().min(1).max(120),
  wedding_date: z.string().min(4),
  notes: z.string().max(2000).optional().nullable(),
  total_installments: z.number().int().min(1).max(4),
  planning_fee: z.number().nonnegative(),
  target_income: z.number().nonnegative().optional(),
});

export const bulkInsertProjectsServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ rows: z.array(projectInputSchema) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    let inserted = 0;
    // One at a time (not a single bulk insert) — each project also needs its
    // own seeded project_payments rows, same as the single-create path.
    for (const row of data.rows) {
      const { data: created, error } = await supabaseAdmin
        .from("projects")
        .insert({
          bride_name: row.bride_name,
          groom_name: row.groom_name,
          wedding_date: row.wedding_date,
          notes: row.notes ?? null,
          total_installments: row.total_installments,
          planning_fee: row.planning_fee,
          target_income: row.target_income ?? 0,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (created?.id) {
        const seedRows = Array.from({ length: row.total_installments }, (_, i) => ({
          project_id: created.id as string,
          installment_no: i + 1,
          label: `Installment ${i + 1}`,
          expected_amount: 0,
          received_amount: 0,
          status: "pending" as const,
          created_by: context.userId,
        }));
        await supabaseAdmin.from("project_payments").insert(seedRows);
        inserted++;
      }
    }
    return inserted;
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
        planning_fee: z.number().nonnegative().optional(),
        target_income: z.number().nonnegative().optional(),
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

async function assertTargetIsClient(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  if (error) throw new Error(error.message);
  if (data && data.length > 0) {
    throw new Error("Forbidden: cannot modify staff accounts");
  }
}

export const resetProjectClientPassword = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    await assertTargetIsClient(data.user_id);
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
    await assertTargetIsClient(data.user_id);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      email: data.email,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setProjectClientDisplayName = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), display_name: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    await assertTargetIsClient(data.user_id);
    const display_name = data.display_name.trim();
    if (!display_name) throw new Error("Name is required");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name, updated_at: new Date().toISOString() })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    // Keep auth user_metadata in sync.
    await supabaseAdmin.auth.admin
      .updateUserById(data.user_id, { user_metadata: { display_name } })
      .catch(() => {});
    return { ok: true };
  });


export const removeProjectClient = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
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
    const projectId = link.project_id;

    // Run project + project_vendors in parallel — neither depends on the other.
    const [projectRes, pvRes] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id, bride_name, groom_name, wedding_date")
        .eq("id", projectId)
        .maybeSingle(),
      supabaseAdmin
        .from("project_vendors")
        .select("vendor_id, is_saffron_pick, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);
    if (projectRes.error) throw new Error(projectRes.error.message);
    const project = projectRes.data;
    if (!project) throw new Error("Project not found");

    const pv = pvRes.data;
    // Preserve the assignment order (newest first) for the final vendor list.
    const vendorIds = (pv ?? []).map((r) => r.vendor_id);
    const saffronPickMap = new Map<string, boolean>(
      (pv ?? []).map((r) => [r.vendor_id, !!r.is_saffron_pick]),
    );
    if (vendorIds.length === 0) {
      return { project, vendors: [] };
    }

    // Fan out all per-vendor queries in parallel.
    const [vendorsRes, attsRes, statusesRes, quotesRes, commentsRes] = await Promise.all([
      supabaseAdmin
        .from("vendors")
        .select("id, category, subcategory, vendor_name, location, instagram_handle, price_text, portfolio_link, website, google_rating")
        .in("id", vendorIds),
      supabaseAdmin
        .from("vendor_attachments")
        .select("id, vendor_id, file_name, file_path, mime_type, size_bytes")
        .in("vendor_id", vendorIds),
      supabaseAdmin
        .from("client_vendor_status")
        .select("vendor_id, status")
        .eq("user_id", userId)
        .in("vendor_id", vendorIds),
      supabaseAdmin
        .from("project_vendor_quotes")
        .select("id, vendor_id, status, is_final, quote_amount, closed_amount, created_at")
        .eq("project_id", projectId)
        .in("vendor_id", vendorIds)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("project_vendor_comments")
        .select("vendor_id")
        .eq("project_id", projectId)
        .in("vendor_id", vendorIds),
    ]);
    if (vendorsRes.error) throw new Error(vendorsRes.error.message);
    const vrows = vendorsRes.data;
    const atts = attsRes.data;

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

    const statusMap = new Map<string, string>(
      (statusesRes.data ?? []).map((s) => [s.vendor_id, s.status]),
    );

    const qrows = quotesRes.data;
    const quoteSummaryByVendor = new Map<string, { count: number; latest_status: string | null; latest_amount: number | null; has_closed: boolean; closed_amount: number | null }>();
    const quotesByVendor = new Map<string, { id: string; status: string; is_final: boolean; quote_amount: number | null; closed_amount: number | null; created_at: string }[]>();
    for (const q of qrows ?? []) {
      const s = quoteSummaryByVendor.get(q.vendor_id) ?? { count: 0, latest_status: null, latest_amount: null, has_closed: false, closed_amount: null };
      s.count += 1;
      if (s.latest_status === null) s.latest_status = q.status;
      if (s.latest_amount === null) s.latest_amount = q.quote_amount;
      if (q.is_final || q.status === "closed") {
        s.has_closed = true;
        if (s.closed_amount == null) s.closed_amount = q.closed_amount;
      }
      quoteSummaryByVendor.set(q.vendor_id, s);
      const list = quotesByVendor.get(q.vendor_id) ?? [];
      list.push({
        id: q.id,
        status: q.status,
        is_final: q.is_final,
        quote_amount: q.quote_amount,
        closed_amount: q.closed_amount,
        created_at: q.created_at,
      });
      quotesByVendor.set(q.vendor_id, list);
    }

    // Per-vendor comment counts (across all clients on this project)
    const commentCountByVendor = new Map<string, number>();
    for (const c of commentsRes.data ?? []) {
      commentCountByVendor.set(c.vendor_id, (commentCountByVendor.get(c.vendor_id) ?? 0) + 1);
    }

    const vendorById = new Map((vrows ?? []).map((v) => [v.id, v]));
    const vendors = vendorIds
      .map((id) => vendorById.get(id))
      .filter((v): v is NonNullable<typeof v> => !!v)
      .map((v) => ({
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
      quote_summary: quoteSummaryByVendor.get(v.id) ?? { count: 0, latest_status: null, latest_amount: null, has_closed: false, closed_amount: null },
      quotes: quotesByVendor.get(v.id) ?? [],
      comment_count: commentCountByVendor.get(v.id) ?? 0,
      is_saffron_pick: saffronPickMap.get(v.id) ?? false,
    }));

    return { project, vendors };
  });

export const setVendorSaffronPick = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        vendor_id: z.string().uuid(),
        is_saffron_pick: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin
      .from("project_vendors")
      .update({ is_saffron_pick: data.is_saffron_pick })
      .eq("project_id", data.project_id)
      .eq("vendor_id", data.vendor_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function loadVendorContext(projectId: string, vendorId: string, userId: string) {
  const [{ data: project }, { data: vendor }, { data: profile }, { data: userRow }] =
    await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id, bride_name, groom_name, wedding_date")
        .eq("id", projectId)
        .maybeSingle(),
      supabaseAdmin
        .from("vendors")
        .select("id, vendor_name, category")
        .eq("id", vendorId)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(userId),
    ]);

  const projectName = project ? `${project.bride_name} & ${project.groom_name}` : undefined;
  const weddingDate = project?.wedding_date
    ? new Date(project.wedding_date).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : undefined;
  return {
    projectName,
    weddingDate,
    vendorName: vendor?.vendor_name ?? "Vendor",
    vendorCategory: vendor?.category ?? undefined,
    clientName:
      profile?.display_name || userRow?.user?.email?.split("@")[0] || "Client",
    clientEmail: userRow?.user?.email ?? undefined,
    adminUrl: project ? `https://planwithsaffron.in/admin/projects/${project.id}` : undefined,
  };
}

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
      .select("vendor_id, project_id")
      .in("project_id", projectIds)
      .eq("vendor_id", data.vendor_id)
      .maybeSingle();
    if (!pv) throw new Error("Vendor not available to this client");

    // Read previous status to avoid noisy "no-op" emails
    const { data: prevRow } = await supabaseAdmin
      .from("client_vendor_status")
      .select("status")
      .eq("user_id", userId)
      .eq("vendor_id", data.vendor_id)
      .maybeSingle();
    const previousStatus = prevRow?.status ?? null;

    if (data.status === null) {
      const { error } = await supabaseAdmin
        .from("client_vendor_status")
        .delete()
        .eq("user_id", userId)
        .eq("vendor_id", data.vendor_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("client_vendor_status")
        .upsert(
          { user_id: userId, vendor_id: data.vendor_id, status: data.status },
          { onConflict: "user_id,vendor_id" },
        );
      if (error) throw new Error(error.message);
    }

    // Notify staff in-app if the status actually changed
    if (previousStatus !== data.status) {
      try {
        const { insertStaffNotification } = await import("@/lib/notify-staff.server");
        const ctx = await loadVendorContext(pv.project_id, data.vendor_id, userId);
        await insertStaffNotification({
          kind: "status_change",
          project_id: pv.project_id,
          vendor_id: data.vendor_id,
          actor_user_id: userId,
          title: `${ctx.clientName} marked ${ctx.vendorName} as ${data.status ?? "—"}`,
          body: previousStatus ? `Previously: ${previousStatus}` : null,
          metadata: { ...ctx, previousStatus, newStatus: data.status },
        });
      } catch (e) {
        console.warn("status change notification failed:", e);
      }
    }

    return { ok: true, status: data.status };
  });

// ---------- Project vendor comments ----------

export const listProjectVendorComments = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), vendor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) throw new Error("Authentication is still loading. Please try again.");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication is still loading.");
    const userId = userData.user.id;

    // Authorize: staff OR client on this project
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r) => r.role));
    const isStaff = roleSet.has("admin") || roleSet.has("employee");
    if (!isStaff) {
      const { data: pc } = await supabaseAdmin
        .from("project_clients")
        .select("project_id")
        .eq("user_id", userId)
        .eq("project_id", data.project_id)
        .maybeSingle();
      if (!pc) throw new Error("Forbidden");
    }

    const { data: rows, error } = await supabaseAdmin
      .from("project_vendor_comments")
      .select("id, body, created_at, user_id, parent_id")
      .eq("project_id", data.project_id)
      .eq("vendor_id", data.vendor_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    let nameMap = new Map<string, string>();
    let emailMap = new Map<string, string>();
    let staffSet = new Set<string>();
    if (userIds.length > 0) {
      const [{ data: profs }, { data: roleRows }] = await Promise.all([
        supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", userIds),
        supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", userIds),
      ]);
      nameMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
      staffSet = new Set(
        (roleRows ?? [])
          .filter((r) => r.role === "admin" || r.role === "employee")
          .map((r) => r.user_id),
      );
      // For staff view, also pull emails
      if (isStaff) {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        emailMap = new Map(usersData.users.map((u) => [u.id, u.email ?? ""]));
      }
    }

    return (rows ?? []).map((r) => {
      const isStaffAuthor = staffSet.has(r.user_id);
      return {
        id: r.id,
        body: r.body,
        created_at: r.created_at,
        user_id: r.user_id,
        parent_id: r.parent_id ?? null,
        author_role: isStaffAuthor ? ("staff" as const) : ("client" as const),
        author_name: isStaffAuthor
          ? "Saffron Team"
          : nameMap.get(r.user_id) || (emailMap.get(r.user_id)?.split("@")[0] ?? "Client"),
        author_email: isStaff ? (emailMap.get(r.user_id) ?? null) : null,
        is_own: r.user_id === userId,
      };
    });
  });
/**
 * Every vendor comment thread for a project, in one call — backs the
 * project-level Comments tab, which groups by vendor ("ALLOCATION") instead
 * of requiring you to open each vendor individually. Same author-resolution
 * logic as `listProjectVendorComments`, just not filtered to one vendor_id.
 */
export const listProjectCommentsAllVendors = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) throw new Error("Authentication is still loading. Please try again.");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication is still loading.");
    const userId = userData.user.id;

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r) => r.role));
    const isStaff = roleSet.has("admin") || roleSet.has("employee");
    if (!isStaff) {
      const { data: pc } = await supabaseAdmin
        .from("project_clients")
        .select("project_id")
        .eq("user_id", userId)
        .eq("project_id", data.project_id)
        .maybeSingle();
      if (!pc) throw new Error("Forbidden");
    }

    const { data: rows, error } = await supabaseAdmin
      .from("project_vendor_comments")
      .select("id, body, created_at, user_id, parent_id, vendor_id")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const vendorIds = Array.from(new Set((rows ?? []).map((r) => r.vendor_id)));
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));

    const [{ data: vendorsData }, { data: profs }, { data: roleRows }] = await Promise.all([
      vendorIds.length > 0
        ? supabaseAdmin.from("vendors").select("id, vendor_name").in("id", vendorIds)
        : Promise.resolve({ data: [] as { id: string; vendor_name: string }[] }),
      userIds.length > 0
        ? supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", userIds)
        : Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[] }),
      userIds.length > 0
        ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", userIds)
        : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
    ]);

    const vendorNameMap = new Map((vendorsData ?? []).map((v) => [v.id, v.vendor_name]));
    const nameMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
    const staffSet = new Set(
      (roleRows ?? []).filter((r) => r.role === "admin" || r.role === "employee").map((r) => r.user_id),
    );
    let emailMap = new Map<string, string>();
    if (isStaff && userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      emailMap = new Map(usersData.users.map((u) => [u.id, u.email ?? ""]));
    }

    return (rows ?? []).map((r) => {
      const isStaffAuthor = staffSet.has(r.user_id);
      return {
        id: r.id,
        body: r.body,
        created_at: r.created_at,
        user_id: r.user_id,
        parent_id: r.parent_id ?? null,
        vendor_id: r.vendor_id,
        vendor_name: vendorNameMap.get(r.vendor_id) ?? "Vendor",
        author_role: isStaffAuthor ? ("staff" as const) : ("client" as const),
        author_name: isStaffAuthor
          ? "Saffron Team"
          : nameMap.get(r.user_id) || (emailMap.get(r.user_id)?.split("@")[0] ?? "Client"),
        author_email: isStaff ? (emailMap.get(r.user_id) ?? null) : null,
        is_own: r.user_id === userId,
      };
    });
  });

export const addProjectVendorComment = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z
      .object({
        vendor_id: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        parent_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireClientUser();

    // Find the project this client owns and confirm vendor is on it
    const { data: links } = await supabaseAdmin
      .from("project_clients")
      .select("project_id")
      .eq("user_id", userId);
    const projectIds = (links ?? []).map((l) => l.project_id);
    if (projectIds.length === 0) throw new Error("No project assigned");

    const { data: pv } = await supabaseAdmin
      .from("project_vendors")
      .select("project_id, vendor_id")
      .in("project_id", projectIds)
      .eq("vendor_id", data.vendor_id)
      .maybeSingle();
    if (!pv) throw new Error("Vendor not available to this client");

    const { data: inserted, error } = await supabaseAdmin
      .from("project_vendor_comments")
      .insert({
        project_id: pv.project_id,
        vendor_id: data.vendor_id,
        user_id: userId,
        body: data.body.trim(),
        parent_id: data.parent_id ?? null,
      })
      .select("id, body, created_at, user_id, parent_id")
      .single();
    if (error) throw new Error(error.message);

    // Notify staff in-app — best-effort
    try {
      const { insertStaffNotification } = await import("@/lib/notify-staff.server");
      const ctx = await loadVendorContext(pv.project_id, data.vendor_id, userId);
      await insertStaffNotification({
        kind: "comment",
        project_id: pv.project_id,
        vendor_id: data.vendor_id,
        actor_user_id: userId,
        title: `${ctx.clientName} commented on ${ctx.vendorName}`,
        body: inserted.body.slice(0, 500),
        metadata: { ...ctx, commentBody: inserted.body },
      });
    } catch (e) {
      console.warn("comment notification failed:", e);
    }

    return inserted;
  });

export const addStaffVendorComment = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        vendor_id: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        parent_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) throw new Error("Authentication is still loading.");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication is still loading.");
    const staffId = userData.user.id;
    await assertStaff(staffId);

    // Confirm vendor is on this project
    const { data: pv } = await supabaseAdmin
      .from("project_vendors")
      .select("project_id")
      .eq("project_id", data.project_id)
      .eq("vendor_id", data.vendor_id)
      .maybeSingle();
    if (!pv) throw new Error("Vendor is not assigned to this project");

    // If replying, validate parent belongs to this thread
    let parentAuthorId: string | null = null;
    if (data.parent_id) {
      const { data: parent } = await supabaseAdmin
        .from("project_vendor_comments")
        .select("id, user_id, project_id, vendor_id")
        .eq("id", data.parent_id)
        .maybeSingle();
      if (
        !parent ||
        parent.project_id !== data.project_id ||
        parent.vendor_id !== data.vendor_id
      ) {
        throw new Error("Reply target not found in this thread");
      }
      parentAuthorId = parent.user_id;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("project_vendor_comments")
      .insert({
        project_id: data.project_id,
        vendor_id: data.vendor_id,
        user_id: staffId,
        body: data.body.trim(),
        parent_id: data.parent_id ?? null,
      })
      .select("id, body, created_at, user_id, parent_id")
      .single();
    if (error) throw new Error(error.message);

    // Fan out to all clients on the project — in-app notifications
    try {
      const { data: clients } = await supabaseAdmin
        .from("project_clients")
        .select("user_id")
        .eq("project_id", data.project_id);
      const clientIds = (clients ?? []).map((c) => c.user_id);
      if (clientIds.length > 0) {
        const [{ data: vendorRow }, { data: parentAuthorProfile }] = await Promise.all([
          supabaseAdmin
            .from("vendors")
            .select("vendor_name")
            .eq("id", data.vendor_id)
            .maybeSingle(),
          parentAuthorId
            ? supabaseAdmin
                .from("profiles")
                .select("display_name")
                .eq("user_id", parentAuthorId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const vendorName = vendorRow?.vendor_name ?? "a vendor";
        const replyTargetName = parentAuthorProfile?.display_name ?? "your comment";

        const rows = clientIds.map((uid) => {
          const isReplyRecipient = parentAuthorId && uid === parentAuthorId;
          const isReply = !!data.parent_id;
          const title = isReplyRecipient
            ? `Saffron replied to your comment on ${vendorName}`
            : isReply
              ? `Saffron replied to ${replyTargetName} on ${vendorName}`
              : `Saffron added a comment on ${vendorName}`;
          return {
            user_id: uid,
            project_id: data.project_id,
            vendor_id: data.vendor_id,
            actor_user_id: staffId,
            kind: isReply ? "staff_reply" : "staff_comment",
            title,
            body: inserted.body.slice(0, 500),
            metadata: { vendorName, commentBody: inserted.body, parent_id: data.parent_id ?? null },
          };
        });
        const { error: notifErr } = await supabaseAdmin
          .from("client_notifications")
          .insert(rows);
        if (notifErr) console.warn("client notification insert failed:", notifErr.message);
      }
    } catch (e) {
      console.warn("client comment fan-out failed:", e);
    }

    return inserted;
  });

export const deleteProjectVendorComment = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) throw new Error("Authentication is still loading.");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication is still loading.");
    const userId = userData.user.id;

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");

    let q = supabaseAdmin.from("project_vendor_comments").delete().eq("id", data.id);
    if (!isAdmin) q = q.eq("user_id", userId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------- Client-facing project vendor quotes (sanitized) ----------

export const listMyProjectVendorQuotes = createServerFn({ method: "GET" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), vendor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireClientUser();

    // Authorize: this client must be on the project and the vendor must be on it.
    const { data: link } = await supabaseAdmin
      .from("project_clients")
      .select("project_id")
      .eq("user_id", userId)
      .eq("project_id", data.project_id)
      .maybeSingle();
    if (!link) throw new Error("Forbidden");

    const { data: pv } = await supabaseAdmin
      .from("project_vendors")
      .select("vendor_id")
      .eq("project_id", data.project_id)
      .eq("vendor_id", data.vendor_id)
      .maybeSingle();
    if (!pv) throw new Error("Vendor not available to this client");

    // Return only client-safe columns (no `notes`, no `created_by`).
    const { data: quotes, error } = await supabaseAdmin
      .from("project_vendor_quotes")
      .select(
        "id, project_id, vendor_id, category, quote_text, quote_amount, currency, status, is_final, closed_amount, created_at, updated_at",
      )
      .eq("project_id", data.project_id)
      .eq("vendor_id", data.vendor_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const quoteIds = (quotes ?? []).map((q) => q.id);
    let filesByQuote = new Map<string, any[]>();
    if (quoteIds.length > 0) {
      const { data: files, error: fErr } = await supabaseAdmin
        .from("project_vendor_quote_files")
        .select("id, quote_id, file_path, file_name, mime_type, size_bytes, created_at")
        .in("quote_id", quoteIds)
        .order("created_at", { ascending: true });
      if (fErr) throw new Error(fErr.message);
      for (const f of files ?? []) {
        const list = filesByQuote.get(f.quote_id) ?? [];
        list.push(f);
        filesByQuote.set(f.quote_id, list);
      }
    }

    return (quotes ?? []).map((q) => ({
      ...q,
      files: filesByQuote.get(q.id) ?? [],
    }));
  });

// Staff-only variant used by the admin "View as client" preview, so admins
// can see the same sanitized quote shape without tripping requireClientUser.
export const getProjectVendorQuotesForPreview = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), vendor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.userId);

    const { data: quotes, error } = await supabaseAdmin
      .from("project_vendor_quotes")
      .select(
        "id, project_id, vendor_id, category, quote_text, quote_amount, currency, status, is_final, closed_amount, created_at, updated_at",
      )
      .eq("project_id", data.project_id)
      .eq("vendor_id", data.vendor_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const quoteIds = (quotes ?? []).map((q) => q.id);
    const filesByQuote = new Map<string, any[]>();
    if (quoteIds.length > 0) {
      const { data: files, error: fErr } = await supabaseAdmin
        .from("project_vendor_quote_files")
        .select("id, quote_id, file_path, file_name, mime_type, size_bytes, created_at")
        .in("quote_id", quoteIds)
        .order("created_at", { ascending: true });
      if (fErr) throw new Error(fErr.message);
      for (const f of files ?? []) {
        const list = filesByQuote.get(f.quote_id) ?? [];
        list.push(f);
        filesByQuote.set(f.quote_id, list);
      }
    }

    return (quotes ?? []).map((q) => ({
      ...q,
      files: filesByQuote.get(q.id) ?? [],
    }));
  });
