// Server-only helper: notify staff by POSTing to the local
// /lovable/email/transactional/send route. We forward the caller's bearer
// token (the client/admin user) so the route's auth check passes.
//
// All errors are caught by the caller — email failures must never block
// the user-facing action.

import { getRequestHeader, getRequest } from "@tanstack/react-start/server";

export async function notifyStaff(params: {
  templateName: string;
  templateData: Record<string, any>;
  idempotencyKey: string;
}): Promise<void> {
  const auth = getRequestHeader("authorization");
  if (!auth) {
    console.warn("notifyStaff: no authorization header on request, skipping");
    return;
  }

  // Build absolute URL from incoming request — works in Worker SSR.
  const req = getRequest();
  const url = new URL("/lovable/email/transactional/send", req.url);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify({
      templateName: params.templateName,
      templateData: params.templateData,
      idempotencyKey: params.idempotencyKey,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("notifyStaff: send route returned", res.status, body);
  }
}
