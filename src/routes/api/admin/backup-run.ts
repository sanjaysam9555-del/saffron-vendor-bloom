import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackup } from "@/server/data-tables.server";

/**
 * Called by a Supabase pg_cron job at midnight IST — not reachable from the
 * browser. Authenticated the same way as the email queue processor
 * (src/routes/lovable/email/queue/process.ts): the caller sends the
 * service-role key as a Bearer token, since pg_cron has no Supabase user
 * session to attach.
 */
export const Route = createFileRoute("/api/admin/backup-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
          console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (token !== serviceKey) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        try {
          const backup = await runBackup(supabaseAdmin, "automatic", null);
          return Response.json({ ok: true, backup_id: backup.id, label: backup.label });
        } catch (err) {
          console.error("Automatic backup failed", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Backup failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
