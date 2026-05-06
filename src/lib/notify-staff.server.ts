// Server-only helper to enqueue staff notification emails.
// Uses the same pgmq enqueue path as /lovable/email/transactional/send,
// so we don't need to make an HTTP call. Failures are swallowed by the caller.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { render } from "@react-email/components";
import * as React from "react";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SENDER_DOMAIN = "notify.planwithsaffron.in";
const FROM_DOMAIN = "planwithsaffron.in";
const SITE_NAME = "Saffron Events";

export async function notifyStaff(params: {
  templateName: string;
  templateData: Record<string, any>;
  idempotencyKey: string;
}) {
  const tpl = TEMPLATES[params.templateName];
  if (!tpl) throw new Error(`Unknown template: ${params.templateName}`);

  const recipient = tpl.to;
  if (!recipient) throw new Error(`Template ${params.templateName} has no fixed recipient`);

  // Suppression check
  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("email")
    .eq("email", recipient.toLowerCase())
    .maybeSingle();
  if (suppressed) return { skipped: "suppressed" as const };

  // Idempotency check
  const { data: existing } = await supabaseAdmin
    .from("email_send_log")
    .select("id")
    .eq("metadata->>idempotency_key", params.idempotencyKey)
    .limit(1)
    .maybeSingle();
  if (existing) return { skipped: "duplicate" as const };

  const subject =
    typeof tpl.subject === "function" ? tpl.subject(params.templateData) : tpl.subject;

  const Component = tpl.component as React.ComponentType<any>;
  const html = await render(React.createElement(Component, params.templateData));
  const text = await render(React.createElement(Component, params.templateData), {
    plainText: true,
  });

  const messageId = crypto.randomUUID();

  const payload = {
    messageId,
    templateName: params.templateName,
    recipientEmail: recipient,
    senderDomain: SENDER_DOMAIN,
    fromAddress: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
    subject,
    html,
    text,
    idempotencyKey: params.idempotencyKey,
    siteName: SITE_NAME,
  };

  await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload,
  });

  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: params.templateName,
    recipient_email: recipient,
    status: "pending",
    metadata: { idempotency_key: params.idempotencyKey },
  });

  return { ok: true as const, messageId };
}
