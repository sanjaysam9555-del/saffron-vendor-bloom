/**
 * Canonical list of every public-schema table this app owns, in FK-safe
 * dependency order (a table only appears after every table it references).
 * Determined by reading each table's actual REFERENCES constraints in
 * supabase/migrations/*.sql — most "project_id"/"vendor_id" columns in this
 * schema are plain UUIDs enforced at the application level, not real FKs;
 * only the tables below with a genuine DB-level FK are order-sensitive.
 *
 * Used for:
 *  - Export All Data / backups: order doesn't matter, but one canonical list
 *    keeps every consumer consistent.
 *  - Restore: insert in this order (parents before children); delete in the
 *    reverse of this order (children before parents).
 */
export const ALL_TABLES = [
  // Tier 0 — no dependencies on other tables in this list
  "categories",
  "vendors",
  "projects",
  "inbound_leads",
  "instagram_backfill_jobs",
  "profiles",
  "user_roles",
  "email_send_state",
  "suppressed_emails",
  "email_unsubscribe_tokens",
  "email_send_log",

  // Tier 1 — depend on projects and/or vendors
  "project_clients",
  "project_category_deadlines",
  "project_guests",
  "project_other_expenses",
  "project_payments",
  "project_tasks",
  "project_vendors",
  "vendor_attachments",
  "vendor_instagram_previews",
  "client_vendor_status",
  "staff_notifications",
  "client_notifications",

  // Tier 2 — depend on Tier 0/1
  "project_vendor_quotes",

  // Tier 3 — depend on project_vendor_quotes
  "project_vendor_quote_files",
  "project_quote_commissions",
  "vendor_commission_payments",
  "vendor_payment_installments",
  "project_vendor_comments",
] as const;

export type TableName = (typeof ALL_TABLES)[number];

/** Delete order for restore: children before parents (reverse of ALL_TABLES). */
export const DELETE_ORDER: readonly TableName[] = [...ALL_TABLES].reverse();

/**
 * Every table's primary key is `id` except these two — confirmed against
 * information_schema.table_constraints, not assumed. Needed because "delete
 * every row" has to filter on a column that's guaranteed to exist and be
 * non-null on every row, which only the real PK guarantees.
 */
const PRIMARY_KEY_OVERRIDES: Partial<Record<TableName, string>> = {
  project_quote_commissions: "quote_id",
  vendor_instagram_previews: "vendor_id",
};

export function primaryKeyOf(table: TableName): string {
  return PRIMARY_KEY_OVERRIDES[table] ?? "id";
}

const PAGE_SIZE = 1000;

export interface TableDump {
  [table: string]: Record<string, any>[];
}

export interface DataDump {
  generated_at: string;
  source: "manual" | "automatic";
  tables: TableDump;
  row_counts: Record<string, number>;
}

/**
 * Fetches every row of every table in ALL_TABLES, paginating past
 * PostgREST's default row cap so large tables come back complete.
 */
export async function dumpAllTables(
  supabaseAdmin: any,
  source: "manual" | "automatic",
): Promise<DataDump> {
  const tables: TableDump = {};
  const row_counts: Record<string, number> = {};

  for (const table of ALL_TABLES) {
    const rows: Record<string, any>[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select("*")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed reading ${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    tables[table] = rows;
    row_counts[table] = rows.length;
  }

  return { generated_at: new Date().toISOString(), source, tables, row_counts };
}

export const BACKUPS_BUCKET = "backups";

export interface BackupRow {
  id: string;
  file_path: string;
  label: string;
  kind: "automatic" | "manual";
  size_bytes: number | null;
  row_counts: Record<string, number>;
  created_by: string | null;
  created_at: string;
}

/**
 * Runs a full dump, uploads it to the backups bucket, and records it in the
 * `backups` metadata table. Shared by the manual "Run backup now" server fn
 * and the HTTP endpoint pg_cron calls at midnight — the two entry points
 * differ only in auth and `kind`.
 */
export async function runBackup(
  supabaseAdmin: any,
  kind: "automatic" | "manual",
  createdBy: string | null,
): Promise<BackupRow> {
  const dump = await dumpAllTables(supabaseAdmin, kind);
  const json = JSON.stringify(dump);
  const sizeBytes = new TextEncoder().encode(json).length;

  const now = new Date(dump.generated_at);
  const filePath = `${now.toISOString().replace(/[:.]/g, "-")}-${kind}.json`;
  const label = `${kind === "automatic" ? "Automatic" : "Manual"} backup — ${now.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  })}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BACKUPS_BUCKET)
    .upload(filePath, json, { contentType: "application/json", upsert: false });
  if (uploadError) throw new Error(`Backup upload failed: ${uploadError.message}`);

  const { data: row, error: insertError } = await supabaseAdmin
    .from("backups")
    .insert({
      file_path: filePath,
      label,
      kind,
      size_bytes: sizeBytes,
      row_counts: dump.row_counts,
      created_by: createdBy,
    })
    .select()
    .single();
  if (insertError) throw new Error(`Backup record failed: ${insertError.message}`);

  return row as BackupRow;
}
