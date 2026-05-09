// Server-only helper: enqueue a transactional email notification to staff.
// Calls the shared in-process enqueue helper directly — DO NOT switch this
// back to a self-fetch of /lovable/email/transactional/send: Cloudflare
// Workers cannot reliably fetch their own deployment URL from inside a
// request handler, which is what was silently breaking comment emails.

import { enqueueTransactionalEmail } from "./email/enqueue-transactional.server";

export async function notifyStaff(params: {
  templateName: string;
  templateData: Record<string, any>;
  idempotencyKey: string;
}): Promise<void> {
  await enqueueTransactionalEmail({
    templateName: params.templateName,
    templateData: params.templateData,
    idempotencyKey: params.idempotencyKey,
  });
}
