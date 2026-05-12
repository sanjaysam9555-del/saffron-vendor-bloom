// Insert an in-app staff notification (replaces previous email pipeline).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function insertStaffNotification(params: {
  kind: "comment" | "status_change";
  project_id?: string | null;
  vendor_id?: string | null;
  actor_user_id?: string | null;
  title: string;
  body?: string | null;
  metadata?: Record<string, any>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("staff_notifications").insert({
    kind: params.kind,
    project_id: params.project_id ?? null,
    vendor_id: params.vendor_id ?? null,
    actor_user_id: params.actor_user_id ?? null,
    title: params.title,
    body: params.body ?? null,
    metadata: params.metadata ?? {},
  });
  if (error) console.warn("staff notification insert failed:", error.message);
}

// Backwards-compat shim — older callers passed templateName/templateData for emails.
export async function notifyStaff(params: {
  templateName: string;
  templateData: Record<string, any>;
  idempotencyKey: string;
}): Promise<void> {
  const d = params.templateData ?? {};
  if (params.templateName === "client-comment-notification") {
    await insertStaffNotification({
      kind: "comment",
      title: `${d.clientName ?? "A client"} commented on ${d.vendorName ?? "a vendor"}`,
      body: typeof d.commentBody === "string" ? d.commentBody.slice(0, 500) : null,
      metadata: d,
    });
  } else if (params.templateName === "client-status-change-notification") {
    await insertStaffNotification({
      kind: "status_change",
      title: `${d.clientName ?? "A client"} marked ${d.vendorName ?? "a vendor"} as ${d.newStatus ?? "—"}`,
      body: d.previousStatus ? `Previously: ${d.previousStatus}` : null,
      metadata: d,
    });
  }
}
