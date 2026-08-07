import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export const listUsers = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: usersData, error: ue } = await supabaseAdmin.auth.admin.listUsers();
    if (ue) throw new Error(ue.message);

    const ids = usersData.users.map((u) => u.id);
    const [{ data: roles }, { data: profiles }, { data: clientLinks }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", ids),
      supabaseAdmin.from("project_clients").select("user_id, project_id").in("user_id", ids),
    ]);

    const projectIds = Array.from(new Set((clientLinks ?? []).map((l) => l.project_id)));
    const { data: projectRows } = projectIds.length
      ? await supabaseAdmin.from("projects").select("id, bride_name, groom_name").in("id", projectIds)
      : { data: [] as { id: string; bride_name: string; groom_name: string }[] };
    const projectNameMap = new Map((projectRows ?? []).map((p) => [p.id, `${p.bride_name} & ${p.groom_name}`]));
    const projectsByUser = new Map<string, string[]>();
    for (const link of clientLinks ?? []) {
      const name = projectNameMap.get(link.project_id);
      if (!name) continue;
      const arr = projectsByUser.get(link.user_id) ?? [];
      arr.push(name);
      projectsByUser.set(link.user_id, arr);
    }

    const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) ?? []);
    const nameMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) ?? []);

    return usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      role: (roleMap.get(u.id) as "admin" | "employee" | "client" | undefined) ?? "employee",
      display_name: nameMap.get(u.id) ?? "",
      projects: projectsByUser.get(u.id) ?? [],
    }));
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => {
    const parsed = z
      .object({
        email: z
          .string()
          .email()
          .refine((e) => e.toLowerCase().endsWith("@saffronevents.in"), {
            message: "Staff accounts must use an @saffronevents.in email",
          }),
        password: z.string().min(6),
        display_name: z.string().min(1),
      })
      .safeParse(d);
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues[0]?.message ?? "Invalid employee details",
      );
    }
    return parsed.data;
  })

  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name, role: "employee" },
    });
    if (error) throw new Error(error.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Failed to create user");

    // handle_new_user trigger inserts a default 'client' role. Replace with 'employee'.
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", newUserId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "employee" });
    if (insErr) throw new Error(insErr.message);

    return { id: newUserId };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    // Force-logout the user from all active sessions so they must sign in with the new password.
    // Best-effort: signOut may fail on some Supabase versions when called with a user_id
    // instead of a JWT — the password update above already invalidates existing sessions
    // on next refresh, so we don't want to fail the whole request over it.
    try {
      await supabaseAdmin.auth.admin.signOut(data.user_id, "global");
    } catch {
      // ignore
    }
    return { ok: true };
  });

export const setUserDisplayName = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), display_name: z.string().min(1) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.display_name, updated_at: new Date().toISOString() })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Cannot delete yourself");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

