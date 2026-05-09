// Server-only helper that renders + enqueues a transactional email.
// Used both by the /lovable/email/transactional/send HTTP route and by
// in-process callers (server functions) so they share one pipeline.
//
// Cloudflare Workers cannot reliably fetch their own deployment URL from
// inside a request handler — that is why server functions must NOT call the
// route via fetch. They must call this helper directly.

import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE_NAME = "saffron-vendor-bloom";
const SENDER_DOMAIN = "notify.planwithsaffron.in";
const FROM_DOMAIN = "planwithsaffron.in";

function redactEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***";
  return `${localPart[0]}***@${domain}`;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type EnqueueResult =
  | { success: true; queued: true; messageId: string }
  | { success: false; reason: string };

export async function enqueueTransactionalEmail(params: {
  templateName: string;
  recipientEmail?: string;
  idempotencyKey?: string;
  templateData?: Record<string, any>;
}): Promise<EnqueueResult> {
  const { templateName } = params;
  const templateData = params.templateData ?? {};
  const messageId = crypto.randomUUID();
  const idempotencyKey = params.idempotencyKey || messageId;

  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  const effectiveRecipient = template.to || params.recipientEmail;
  if (!effectiveRecipient) {
    throw new Error(
      "recipientEmail is required (unless the template defines a fixed recipient)",
    );
  }

  // Suppression check
  const { data: suppressed, error: suppressionError } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", effectiveRecipient.toLowerCase())
    .maybeSingle();

  if (suppressionError) {
    console.error("Suppression check failed — refusing to send", {
      error: suppressionError,
      recipient_redacted: redactEmail(effectiveRecipient),
    });
    throw new Error("Failed to verify suppression status");
  }

  if (suppressed) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "suppressed",
    });
    return { success: false, reason: "email_suppressed" };
  }

  // Get or create unsubscribe token
  const normalizedEmail = effectiveRecipient.toLowerCase();
  let unsubscribeToken: string;

  const { data: existingToken, error: tokenLookupError } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (tokenLookupError) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "failed",
      error_message: "Failed to look up unsubscribe token",
    });
    throw new Error("Failed to prepare email (token lookup)");
  }

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token;
  } else if (!existingToken) {
    unsubscribeToken = generateToken();
    const { error: tokenError } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: "email", ignoreDuplicates: true },
      );

    if (tokenError) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: "failed",
        error_message: "Failed to create unsubscribe token",
      });
      throw new Error("Failed to prepare email (token create)");
    }

    const { data: storedToken, error: reReadError } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (reReadError || !storedToken) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: "failed",
        error_message: "Failed to confirm unsubscribe token storage",
      });
      throw new Error("Failed to prepare email (token confirm)");
    }
    unsubscribeToken = storedToken.token;
  } else {
    // Token used but email not on suppression list — safety fallback
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "suppressed",
      error_message: "Unsubscribe token used but email missing from suppressed list",
    });
    return { success: false, reason: "email_suppressed" };
  }

  // Render template
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const plainText = await render(element, { plainText: true });

  const resolvedSubject =
    typeof template.subject === "function"
      ? template.subject(templateData)
      : template.subject;

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: "pending",
  });

  const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: "transactional",
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
    throw new Error("Failed to enqueue email");
  }

  console.log("Transactional email enqueued", {
    templateName,
    recipient_redacted: redactEmail(effectiveRecipient),
  });

  return { success: true, queued: true, messageId };
}
