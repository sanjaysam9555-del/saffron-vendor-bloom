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

export const getQuoteCommission = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ quote_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("project_quote_commissions")
      .select("*")
      .eq("quote_id", data.quote_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as {
      quote_id: string;
      commission_amount: number;
      notes: string | null;
    } | null;
  });

export const setQuoteCommission = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quote_id: z.string().uuid(),
        commission_amount: z.number().nonnegative(),
        notes: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("project_quote_commissions")
      .upsert(
        {
          quote_id: data.quote_id,
          commission_amount: data.commission_amount,
          notes: data.notes ?? null,
        },
        { onConflict: "quote_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
