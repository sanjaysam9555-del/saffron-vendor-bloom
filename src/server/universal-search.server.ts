/**
 * Universal search — one query fan-out across every entity the signed-in
 * user is allowed to see. All reads go through the caller's RLS-scoped
 * Supabase client, so clients can only ever match their own project data.
 *
 * Commission / incentive columns are never selected here, for any role.
 */

export type SearchKind =
  | "vendor"
  | "project"
  | "quote"
  | "task"
  | "comment"
  | "calendar"
  | "alert";

export interface SearchHit {
  type: SearchKind;
  id: string;
  title: string;
  subtitle?: string | null;
  context?: string | null;
  /** Router path to navigate to. */
  to: string;
  /** Optional search params merged into the navigation. */
  search?: Record<string, string>;
}

type Client = any;

/** Escapes PostgREST ilike wildcards so a literal % or _ doesn't match everything. */
function esc(q: string): string {
  return q.replace(/[%_,()]/g, " ").trim();
}

const LIMIT = 5;

function nameOfProject(p: any): string {
  if (!p) return "Project";
  return `${p.bride_name ?? "?"} & ${p.groom_name ?? "?"}`;
}

export async function runUniversalSearch(
  supabase: Client,
  rawQuery: string,
  role: "admin" | "employee" | "client",
): Promise<SearchHit[]> {
  const q = esc(rawQuery);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const isStaff = role === "admin" || role === "employee";
  const hits: SearchHit[] = [];

  const safe = async (p: any): Promise<{ data: any[] } | null> => {
    try {
      const r: any = await p;
      return { data: (r?.data ?? []) as any[] };
    } catch {
      return null;
    }
  };

  const [vendors, projects, quotes, tasks, comments, deadlines, staffAlerts, clientAlerts] =
    await Promise.all([
      safe(
        supabase
          .from("vendors")
          .select("id, vendor_name, category, location, contact_number")
          .or(
            `vendor_name.ilike.${like},category.ilike.${like},location.ilike.${like},contact_number.ilike.${like},subcategory.ilike.${like}`,
          )
          .limit(LIMIT),
      ),
      safe(
        supabase
          .from("projects")
          .select("id, bride_name, groom_name, wedding_date, notes")
          .or(`bride_name.ilike.${like},groom_name.ilike.${like},notes.ilike.${like}`)
          .limit(LIMIT),
      ),
      safe(
        supabase
          .from("project_vendor_quotes")
          .select(
            "id, project_id, vendor_id, category, quote_text, quote_amount, closed_amount, status, vendors(vendor_name), projects(bride_name, groom_name)",
          )
          .or(`quote_text.ilike.${like},category.ilike.${like}`)
          .limit(LIMIT),
      ),
      isStaff
        ? safe(
            supabase
              .from("project_tasks")
              .select(
                "id, project_id, title, owner_name, stage, due_date, projects(bride_name, groom_name)",
              )
              .or(`title.ilike.${like},remarks.ilike.${like},owner_name.ilike.${like}`)
              .limit(LIMIT),
          )
        : null,
      safe(
        supabase
          .from("project_vendor_comments")
          .select(
            "id, project_id, vendor_id, body, created_at, vendors(vendor_name), projects(bride_name, groom_name)",
          )
          .ilike("body", like)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
      ),
      isStaff
        ? safe(
            supabase
              .from("project_category_deadlines")
              .select("id, project_id, category, due_date, projects(bride_name, groom_name)")
              .or(`category.ilike.${like},notes.ilike.${like}`)
              .limit(LIMIT),
          )
        : null,
      isStaff
        ? safe(
            supabase
              .from("staff_notifications")
              .select("id, title, body, created_at, project_id")
              .or(`title.ilike.${like},body.ilike.${like}`)
              .order("created_at", { ascending: false })
              .limit(LIMIT),
          )
        : null,
      !isStaff
        ? safe(
            supabase
              .from("client_notifications")
              .select("id, title, body, created_at")
              .or(`title.ilike.${like},body.ilike.${like}`)
              .order("created_at", { ascending: false })
              .limit(LIMIT),
          )
        : null,
    ]);

  const clientHome = "/client";

  for (const v of vendors?.data ?? []) {
    hits.push({
      type: "vendor",
      id: v.id,
      title: v.vendor_name,
      subtitle: [v.category, v.location].filter(Boolean).join(" · ") || null,
      context: "Vendor",
      to: isStaff ? "/admin" : clientHome,
      search: { v: v.id },
    });
  }

  if (isStaff) {
    for (const p of projects?.data ?? []) {
      hits.push({
        type: "project",
        id: p.id,
        title: nameOfProject(p),
        subtitle: p.wedding_date ?? null,
        context: "Project",
        to: `/admin/projects/${p.id}`,
        search: { tab: "overview" },
      });
    }
  }

  for (const qt of quotes?.data ?? []) {
    const amount = qt.closed_amount ?? qt.quote_amount ?? null;
    hits.push({
      type: "quote",
      id: qt.id,
      title: `${qt.vendors?.vendor_name ?? "Vendor"} — quote`,
      subtitle: [amount != null ? `₹${Number(amount).toLocaleString("en-IN")}` : null, qt.status]
        .filter(Boolean)
        .join(" · "),
      context: isStaff ? nameOfProject(qt.projects) : "Quote",
      to: isStaff ? `/admin/projects/${qt.project_id}` : clientHome,
      search: isStaff ? { tab: "quotesAll", v: qt.vendor_id } : { v: qt.vendor_id },
    });
  }

  for (const t of tasks?.data ?? []) {
    hits.push({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: [t.owner_name, t.due_date].filter(Boolean).join(" · ") || null,
      context: nameOfProject(t.projects),
      to: `/admin/projects/${t.project_id}`,
      search: { tab: "tasks" },
    });
  }

  for (const c of comments?.data ?? []) {
    hits.push({
      type: "comment",
      id: c.id,
      title: (c.body ?? "").slice(0, 90),
      subtitle: c.vendors?.vendor_name ?? null,
      context: isStaff ? nameOfProject(c.projects) : "Comment",
      to: isStaff ? `/admin/projects/${c.project_id}` : clientHome,
      search: isStaff ? { tab: "comments", v: c.vendor_id } : { v: c.vendor_id },
    });
  }

  for (const d of deadlines?.data ?? []) {
    hits.push({
      type: "calendar",
      id: d.id,
      title: `${d.category} deadline`,
      subtitle: d.due_date ?? null,
      context: nameOfProject(d.projects),
      to: "/admin/calendar",
    });
  }

  for (const n of staffAlerts?.data ?? []) {
    hits.push({
      type: "alert",
      id: n.id,
      title: n.title,
      subtitle: n.body ? String(n.body).slice(0, 90) : null,
      context: "Activity feed",
      to: "/admin/notifications",
    });
  }

  for (const n of clientAlerts?.data ?? []) {
    hits.push({
      type: "alert",
      id: n.id,
      title: n.title,
      subtitle: n.body ? String(n.body).slice(0, 90) : null,
      context: "Alert",
      to: clientHome,
    });
  }

  return hits;
}
