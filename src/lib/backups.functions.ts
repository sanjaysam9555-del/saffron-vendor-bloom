import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ALL_TABLES,
  BACKUPS_BUCKET,
  DELETE_ORDER,
  primaryKeyOf,
  runBackup,
  type BackupRow,
  type DataDump,
} from "@/server/data-tables.server";

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

export const listBackupsServer = createServerFn({ method: "GET" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("backups")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BackupRow[];
  });

export const runBackupNowServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return runBackup(supabaseAdmin, "manual", context.userId);
  });

export const getBackupDownloadUrlServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ backup_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: backup, error } = await supabaseAdmin
      .from("backups")
      .select("file_path")
      .eq("id", data.backup_id)
      .single();
    if (error || !backup) throw new Error("Backup not found");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BACKUPS_BUCKET)
      .createSignedUrl(backup.file_path, 300);
    if (!signed?.signedUrl) throw new Error(signError?.message ?? "Backup file missing from storage");
    return { url: signed.signedUrl };
  });

export const deleteBackupServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ backup_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: backup, error } = await supabaseAdmin
      .from("backups")
      .select("file_path")
      .eq("id", data.backup_id)
      .single();
    if (error || !backup) throw new Error("Backup not found");
    await supabaseAdmin.storage.from(BACKUPS_BUCKET).remove([backup.file_path]);
    const { error: delError } = await supabaseAdmin.from("backups").delete().eq("id", data.backup_id);
    if (delError) throw new Error(delError.message);
    return { ok: true };
  });

/**
 * Restores every table from a backup snapshot: deletes all current rows
 * (children before parents) then re-inserts the backup's rows (parents
 * before children). This is NOT a single atomic transaction — the Supabase
 * client has no cross-table transaction support, so a failure partway
 * through can leave the database in a mixed state. The UI requires typing
 * the exact backup label to confirm, and a fresh backup is taken
 * automatically right before restoring so there's always a way back.
 */
export const restoreBackupServer = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ backup_id: z.string().uuid(), confirm_label: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { data: backup, error: backupError } = await supabaseAdmin
      .from("backups")
      .select("*")
      .eq("id", data.backup_id)
      .single();
    if (backupError || !backup) throw new Error("Backup not found");
    if (data.confirm_label !== backup.label) {
      throw new Error("Confirmation text didn't match the backup label exactly.");
    }

    // Safety net: snapshot current state before touching anything.
    await runBackup(supabaseAdmin, "manual", context.userId);

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(BACKUPS_BUCKET)
      .download(backup.file_path);
    if (downloadError || !fileData) throw new Error("Could not download the backup file");
    const dump = JSON.parse(await fileData.text()) as DataDump;

    for (const table of DELETE_ORDER) {
      const pk = primaryKeyOf(table);
      const { error: delError } = await supabaseAdmin.from(table).delete().not(pk, "is", null);
      if (delError) throw new Error(`Restore failed while clearing ${table}: ${delError.message}`);
    }

    for (const table of ALL_TABLES) {
      const rows = dump.tables[table] ?? [];
      if (rows.length === 0) continue;

      // project_vendor_comments has a self-referential parent_id — insert
      // every row with it stripped first, then backfill, so a reply is
      // never inserted before the parent comment it points to exists.
      if (table === "project_vendor_comments") {
        const stripped = rows.map((r) => ({ ...r, parent_id: null }));
        for (let i = 0; i < stripped.length; i += 500) {
          const { error: insError } = await supabaseAdmin.from(table).insert(stripped.slice(i, i + 500) as any);
          if (insError) throw new Error(`Restore failed while inserting ${table}: ${insError.message}`);
        }
        const withParent = rows.filter((r) => r.parent_id);
        for (const r of withParent) {
          await supabaseAdmin.from(table).update({ parent_id: r.parent_id }).eq("id", r.id);
        }
        continue;
      }

      for (let i = 0; i < rows.length; i += 500) {
        const { error: insError } = await supabaseAdmin.from(table).insert(rows.slice(i, i + 500) as any);
        if (insError) throw new Error(`Restore failed while inserting ${table}: ${insError.message}`);
      }
    }

    return { ok: true, restored_at: new Date().toISOString(), row_counts: dump.row_counts };
  });
