import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CategoryBudgetRow {
  category: string;
  planned: number;
  actualClosed: number;
  paid: number;
}

export interface ProjectBudgetSummary {
  planned: number;
  actual: number;
  paid: number;
  categories: CategoryBudgetRow[];
}

async function isStaff(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  return !!(data && data.length > 0);
}

async function hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("project_clients")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();
  return !!data;
}

async function assertCanRead(userId: string, projectId: string) {
  if (await isStaff(userId)) return;
  if (await hasProjectAccess(userId, projectId)) return;
  throw new Error("Forbidden");
}

/**
 * Category-level budget rollup for the Budget tab.
 *
 * "Planned" comes from project_category_deadlines.planned_amount (the same
 * figure the Deadlines tab edits). "Actual (Closed)" sums closed_amount from
 * finalised project_vendor_quotes, by category. "Paid" sums
 * vendor_payment_installments.paid_amount for those same quotes. All three
 * are independent sources joined in-memory rather than a SQL view, since none
 * of them share a single foreign key chain cleanly.
 */
export const getProjectBudgetSummary = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<ProjectBudgetSummary> => {
    await assertCanRead(context.userId, data.project_id);

    const [deadlinesRes, quotesRes] = await Promise.all([
      supabaseAdmin
        .from("project_category_deadlines")
        .select("category, planned_amount")
        .eq("project_id", data.project_id),
      supabaseAdmin
        .from("project_vendor_quotes")
        .select("id, category, closed_amount, is_final, status")
        .eq("project_id", data.project_id),
    ]);
    if (deadlinesRes.error) throw new Error(deadlinesRes.error.message);
    if (quotesRes.error) throw new Error(quotesRes.error.message);

    const closedQuotes = (quotesRes.data ?? []).filter(
      (q) => q.is_final || q.status === "closed",
    );
    const quoteIds = closedQuotes.map((q) => q.id);

    const { data: paymentRows, error: payError } =
      quoteIds.length > 0
        ? await supabaseAdmin
            .from("vendor_payment_installments")
            .select("quote_id, paid_amount")
            .in("quote_id", quoteIds)
        : { data: [] as { quote_id: string; paid_amount: number }[], error: null };
    if (payError) throw new Error(payError.message);

    const paidByQuote = new Map<string, number>();
    for (const p of paymentRows ?? []) {
      paidByQuote.set(p.quote_id, (paidByQuote.get(p.quote_id) ?? 0) + Number(p.paid_amount ?? 0));
    }

    const byCategory = new Map<string, CategoryBudgetRow>();
    const ensure = (cat: string) => {
      const key = cat || "Uncategorised";
      if (!byCategory.has(key)) byCategory.set(key, { category: key, planned: 0, actualClosed: 0, paid: 0 });
      return byCategory.get(key)!;
    };

    for (const d of deadlinesRes.data ?? []) {
      ensure(d.category).planned += Number(d.planned_amount ?? 0);
    }
    for (const q of closedQuotes) {
      const row = ensure(q.category ?? "Uncategorised");
      row.actualClosed += Number(q.closed_amount ?? 0);
      row.paid += paidByQuote.get(q.id) ?? 0;
    }

    const categories = Array.from(byCategory.values()).sort((a, b) => a.category.localeCompare(b.category));
    const totals = categories.reduce(
      (acc, c) => ({
        planned: acc.planned + c.planned,
        actual: acc.actual + c.actualClosed,
        paid: acc.paid + c.paid,
      }),
      { planned: 0, actual: 0, paid: 0 },
    );

    return { ...totals, categories };
  });
