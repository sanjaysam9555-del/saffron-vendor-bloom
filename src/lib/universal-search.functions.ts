import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachAuthToken } from "./auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const universalSearch = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string() }).parse(d ?? { q: "" }))
  .handler(async ({ data, context }) => {
    const { runUniversalSearch } = await import("@/server/universal-search.server");
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const list = (roles ?? []).map((r: any) => r.role as string);
    const role: "admin" | "employee" | "client" = list.includes("admin")
      ? "admin"
      : list.includes("employee")
        ? "employee"
        : "client";
    return await runUniversalSearch(context.supabase, data.q, role);
  });
